/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package software.amazon.smithy.typescript.codegen;

import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.utils.OptionalUtils;

/**
 * Generates a service client and configuration using plugins.
 */
final class ServiceGenerator implements Runnable {

    static final String CLIENT_CONFIG_SECTION = "client_config";
    static final String CLIENT_PROPERTIES_SECTION = "client_properties";
    static final String CLIENT_BODY_EXTRA_SECTION = "client_body_extra";
    static final String CLIENT_CONSTRUCTOR_SECTION = "client_constructor";
    static final String CLIENT_DESTROY_SECTION = "client_destroy";

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final Symbol symbol;
    private final String configType;
    private final String resolvedConfigType;
    private final List<RuntimeClientPlugin> runtimePlugins;
    private final ApplicationProtocol applicationProtocol;

    ServiceGenerator(
            TypeScriptSettings settings,
            Model model,
            ServiceShape service,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            List<RuntimeClientPlugin> runtimePlugins,
            ApplicationProtocol applicationProtocol
    ) {
        this.settings = settings;
        this.model = model;
        this.service = service;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.runtimePlugins = runtimePlugins.stream()
                // Only apply plugins that target the entire client.
                .filter(plugin -> plugin.getOperationNames().isEmpty())
                .collect(Collectors.toList());
        this.applicationProtocol = applicationProtocol;

        symbol = symbolProvider.toSymbol(service);
        configType = symbol.getName() + "Config";
        resolvedConfigType = getResolvedConfigTypeName(symbol);
    }

    static String getResolvedConfigTypeName(Symbol symbol) {
        return symbol.getName() + "ResolvedConfig";
    }

    @Override
    public void run() {
        OperationIndex operationIndex = model.getKnowledge(OperationIndex.class);
        writer.addImport("Client", "SmithyClient", "@aws-sdk/smithy-client");

        // Normalize the input and output types of the command to account for
        // things like an operation adding input where there once wasn't any
        // input, adding output, naming differences between services, etc.
        writeInputOutputTypeUnion("ServiceInputTypes", writer, operationIndex::getInput);
        writeInputOutputTypeUnion("ServiceOutputTypes", writer, operationIndex::getOutput);

        generateConfig();
        writer.write("");
        generateService();
    }

    private void writeInputOutputTypeUnion(
            String typeName,
            TypeScriptWriter writer,
            Function<OperationShape, Optional<StructureShape>> mapper
    ) {
        TopDownIndex topDownIndex = model.getKnowledge(TopDownIndex.class);
        List<Symbol> symbols = topDownIndex.getContainedOperations(service).stream()
                .flatMap(operation -> OptionalUtils.stream(mapper.apply(operation)))
                .map(symbolProvider::toSymbol)
                .collect(Collectors.toList());

        writer.write("export type $L = ", typeName);
        writer.indent();
        for (int i = 0; i < symbols.size(); i++) {
            writer.write("| $T$L", symbols.get(i), i == symbols.size() - 1 ? ";" : "");
        }
        writer.dedent();
        writer.write("");
    }

    private void generateConfig() {
        writer.addImport("SmithyConfiguration", "SmithyConfiguration", "@aws-sdk/smithy-client");
        writer.addImport("SmithyResolvedConfiguration", "SmithyResolvedConfiguration", "@aws-sdk/smithy-client");

        // Hook for intercepting the client configuration.
        writer.pushState(CLIENT_CONFIG_SECTION);

        // Get the configuration symbol types to reference in code. These are
        // all "&"'d together to create a big configuration type that aggregates
        // more modular configuration types.
        List<Symbol> configTypes = runtimePlugins.stream()
                .filter(RuntimeClientPlugin::hasConfig)
                .map(RuntimeClientPlugin::getSymbol)
                .collect(Collectors.toList());

        // The default configuration type is always just the base-level
        // Smithy configuration requirements.
        writer.write("export type $L = SmithyConfiguration<$T>", configType, applicationProtocol.getOptionsType());

        if (!configTypes.isEmpty()) {
            writer.indent();
            for (Symbol symbol : configTypes) {
                writer.write("& $T.Input", symbol);
            }
        }

        // Generate the corresponding "Resolved" configuration type to account for
        // each "Input" configuration type.
        writer.write("export type $L = SmithyResolvedConfiguration<$T>",
                     resolvedConfigType, applicationProtocol.getOptionsType());
        if (!configTypes.isEmpty()) {
            writer.indent();
            for (Symbol symbol : configTypes) {
                writer.write("& $T.Resolved", symbol);
            }
        }

        writer.popState();
    }

    private void generateService() {
        // Write out the service.
        writer.openBlock("export class $L extends SmithyClient<\n"
                         + "  $T,\n"
                         + "  ServiceInputTypes,\n"
                         + "  ServiceOutputTypes\n"
                         + "> {", "}", symbol.getName(), applicationProtocol.getOptionsType(), () -> {
            generateClientProperties();
            generateConstructor();
            writer.write("");
            generateDestroyMethod();
            // Hook for adding more methods to the client.
            writer.pushState(CLIENT_BODY_EXTRA_SECTION).popState();
        });
    }

    private void generateClientProperties() {
        // Hook for adding/changing client properties.
        writer.pushState(CLIENT_PROPERTIES_SECTION);
        writer.write("readonly config: $L;\n", resolvedConfigType);
        writer.popState();
    }

    private void generateConstructor() {
        writer.openBlock("constructor(configuration: $L) {", "}", configType, () -> {
            // Hook for adding/changing the client constructor.
            writer.pushState(CLIENT_CONSTRUCTOR_SECTION);

            int configVariable = 0;
            writer.write("let $L = configuration;", generateConfigVariable(configVariable));

            // Add runtime plugin "resolve" method calls. These are invoked one
            // after the other until all of the runtime plugins have been called.
            // Only plugins that have configuration are called. Each time the
            // configuration is updated, the configuration variable is incremented
            // (e.g., intermediateConfig_0, intermediateConfig_1, etc).
            for (RuntimeClientPlugin plugin : runtimePlugins) {
                if (plugin.hasConfig()) {
                    configVariable++;
                    writer.write("let $L = $T.resolve($L);",
                                 generateConfigVariable(configVariable - 1),
                                 plugin.getSymbol(),
                                 generateConfigVariable(configVariable));
                }
            }

            writer.write("super($L);", generateConfigVariable(configVariable));
            writer.write("this.config = $L;", generateConfigVariable(configVariable));

            // Add runtime plugins that contain middleware to the middleware stack
            // of the client.
            for (RuntimeClientPlugin plugin : runtimePlugins) {
                if (plugin.hasMiddleware()) {
                    writer.write("super.use($T.getMiddleware(this.config));", plugin.getSymbol());
                }
            }

            writer.popState();
        });
    }

    private String generateConfigVariable(int number) {
        return "intermediateConfig_" + number;
    }

    private void generateDestroyMethod() {
        // Generates the destory() method, and calls the destroy() method of
        // any runtime plugin that claims to have a destroy method.
        writer.openBlock("destroy(): void {", "}", () -> {
            writer.pushState(CLIENT_DESTROY_SECTION);
            for (RuntimeClientPlugin plugin : runtimePlugins) {
                if (plugin.hasDestroy()) {
                    writer.write("$T.destroy(this, this.config);", plugin.getSymbol());
                }
            }
            writer.popState();
        });
    }
}
