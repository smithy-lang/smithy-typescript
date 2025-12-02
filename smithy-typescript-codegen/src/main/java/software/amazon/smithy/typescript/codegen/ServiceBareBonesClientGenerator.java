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

import java.nio.file.Paths;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.endpointsV2.EndpointsV2Generator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.typescript.codegen.schema.SchemaGenerationAllowlist;
import software.amazon.smithy.typescript.codegen.sections.ClientBodyExtraCodeSection;
import software.amazon.smithy.typescript.codegen.sections.ClientConfigCodeSection;
import software.amazon.smithy.typescript.codegen.sections.ClientConstructorCodeSection;
import software.amazon.smithy.typescript.codegen.sections.ClientDestroyCodeSection;
import software.amazon.smithy.typescript.codegen.sections.ClientPropertiesCodeSection;
import software.amazon.smithy.typescript.codegen.util.ClientWriterConsumer;
import software.amazon.smithy.utils.OptionalUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates a bare-bones client and configuration for service using plugins.
 */
@SmithyInternalApi
public final class ServiceBareBonesClientGenerator implements Runnable {

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final Symbol symbol;
    private final String configType;
    private final String resolvedConfigType;
    private final List<TypeScriptIntegration> integrations;
    private final List<RuntimeClientPlugin> runtimePlugins;
    private final ApplicationProtocol applicationProtocol;

    ServiceBareBonesClientGenerator(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer,
        List<TypeScriptIntegration> integrations,
        List<RuntimeClientPlugin> runtimePlugins,
        ApplicationProtocol applicationProtocol
    ) {
        this.settings = settings;
        this.model = model;
        this.service = settings.getService(model);
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.integrations = integrations;
        this.runtimePlugins = runtimePlugins.stream()
                // Only apply plugins that target the entire client.
                .filter(plugin -> plugin.matchesService(model, service))
                .collect(Collectors.toList());
        this.applicationProtocol = applicationProtocol;

        symbol = symbolProvider.toSymbol(service);
        configType = getConfigTypeName(symbol);
        resolvedConfigType = getResolvedConfigTypeName(symbol);
    }

    public static String getConfigTypeName(Symbol symbol) {
        return symbol.getName() + "Config";
    }

    public static String getResolvedConfigTypeName(Symbol symbol) {
        return symbol.getName() + "ResolvedConfig";
    }

    @Override
    public void run() {
        writer.addImport("Client", "__Client", TypeScriptDependency.AWS_SMITHY_CLIENT);
        writer.write("export { __Client }\n");
        writer.addRelativeImport("getRuntimeConfig", "__getRuntimeConfig",
            Paths.get(".", CodegenUtils.SOURCE_FOLDER, "runtimeConfig"));

        // Normalize the input and output types of the command to account for
        // things like an operation adding input where there once wasn't any
        // input, adding output, naming differences between services, etc.
        writeInputOutputTypeUnion("ServiceInputTypes", writer,
                operationSymbol -> operationSymbol.getProperty("inputType", Symbol.class), writer -> {
            // Use an empty object if an operation doesn't define input.
            writer.write("| {}");
        });
        writeInputOutputTypeUnion("ServiceOutputTypes", writer,
                operationSymbol -> operationSymbol.getProperty("outputType", Symbol.class), writer -> {
            // Use a MetadataBearer if an operation doesn't define output.
            writer.addTypeImport("MetadataBearer", "__MetadataBearer", TypeScriptDependency.SMITHY_TYPES);
            writer.write("| __MetadataBearer");
        });

        generateConfig();
        writer.write("");
        generateService();
    }

    private void writeInputOutputTypeUnion(
        String typeName,
        TypeScriptWriter writer,
        Function<Symbol, Optional<Symbol>> mapper,
        Consumer<TypeScriptWriter> defaultTypeGenerator
    ) {
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> containedOperations = topDownIndex.getContainedOperations(service);

        List<Symbol> symbols = containedOperations.stream()
                .map(symbolProvider::toSymbol)
                .flatMap(operation -> OptionalUtils.stream(mapper.apply(operation)))
                .sorted(Comparator.comparing(Symbol::getName))
                .collect(Collectors.toList());

        writer.writeDocs("@public");
        writer.write("export type $L = ", typeName);
        writer.indent();
        // If we have less symbols than operations, at least one doesn't have a type, so add the default.
        if (containedOperations.size() != symbols.size() || containedOperations.isEmpty()) {
            defaultTypeGenerator.accept(writer);
        }
        for (int i = 0; i < symbols.size(); i++) {
            writer.write("| $T$L", symbols.get(i), i == symbols.size() - 1 ? ";" : "");
        }
        writer.dedent();
        writer.write("");
    }

    private void generateConfig() {
        writer.addRelativeTypeImport("RuntimeExtensionsConfig", null,
            Paths.get(".", CodegenUtils.SOURCE_FOLDER, "runtimeExtensions"));
        writer.addTypeImport("SmithyConfiguration", "__SmithyConfiguration", TypeScriptDependency.AWS_SMITHY_CLIENT);
        writer.addTypeImport("SmithyResolvedConfiguration", "__SmithyResolvedConfiguration",
            TypeScriptDependency.AWS_SMITHY_CLIENT);

        // Hook for intercepting the client configuration.
        writer.pushState(ClientConfigCodeSection.builder()
            .settings(settings)
            .model(model)
            .service(service)
            .symbolProvider(symbolProvider)
            .integrations(integrations)
            .runtimeClientPlugins(runtimePlugins)
            .applicationProtocol(applicationProtocol)
            .build());

        generateClientDefaults();

        writer.writeDocs("@public");
        // The default configuration type is always just the base-level
        // Smithy configuration requirements.
        writer.write("export type $LType = Partial<__SmithyConfiguration<$T>>", configType,
                applicationProtocol.getOptionsType());
        writer.write("  & ClientDefaults");

        // Get the configuration symbol types to reference in code. These are
        // all "&"'d together to create a big configuration type that aggregates
        // more modular configuration types.
        List<SymbolReference> inputTypes = runtimePlugins.stream()
                .flatMap(p -> OptionalUtils.stream(p.getInputConfig()))
                .collect(Collectors.toList());

        if (!inputTypes.isEmpty()) {
            writer.indent();
            for (SymbolReference symbolReference : inputTypes) {
                if (symbolReference.getAlias().equals("EndpointInputConfig")) {
                    writer.addTypeImport(
                        "EndpointParameters",
                        null,
                        EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY
                    );
                    writer.write("& $T<$L>", symbolReference, "EndpointParameters");
                } else {
                    writer.write("& $T", symbolReference);
                }
            }
            writer.addTypeImport("ClientInputEndpointParameters", null,
                EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY);
            writer.write("& ClientInputEndpointParameters");
            writer.dedent();
        }

        writer.writeDocs(String.format("%s The configuration interface of %s class constructor that set the region, "
                + "credentials and other options.", "@public\n\n", symbol.getName()));
        writer.write("export interface $1L extends $1LType {}", configType);

        // Generate the corresponding "Resolved" configuration type to account for
        // each "Input" configuration type.
        writer.write("");
        writer.writeDocs("@public");
        writer.write("export type $LType = __SmithyResolvedConfiguration<$T>",
                     resolvedConfigType, applicationProtocol.getOptionsType());
        writer.write("  & Required<ClientDefaults>");
        writer.write("  & RuntimeExtensionsConfig");

        if (!inputTypes.isEmpty()) {
            writer.indent();
            runtimePlugins.stream()
                    .flatMap(p -> OptionalUtils.stream(p.getResolvedConfig()))
                    .forEach(symbol -> {
                        if (symbol.getAlias().equals("EndpointResolvedConfig")) {
                            writer.addTypeImport(
                                "EndpointParameters",
                                null,
                                EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY
                            );
                            writer.write("& $T<$L>", symbol, "EndpointParameters");
                        } else {
                            writer.write("& $T", symbol);
                        }
                    });
            writer.addTypeImport("ClientResolvedEndpointParameters", null,
                EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY);
            writer.write("& ClientResolvedEndpointParameters");
            writer.dedent();
        }

        writer.writeDocs(String.format("%s The resolved configuration interface of %s class. This is resolved and"
                + " normalized from the {@link %s | constructor configuration interface}.", "@public\n\n",
                symbol.getName(), configType));
        writer.write("export interface $1L extends $1LType {}", resolvedConfigType);

        writer.popState();
    }

    private void generateClientDefaults() {
        if (!applicationProtocol.isHttpProtocol()) {
            throw new UnsupportedOperationException(
                    "Protocols other than HTTP are not yet implemented: " + applicationProtocol);
        }

        writer.writeDocs("@public")
            .openBlock("export interface ClientDefaults extends Partial<__SmithyConfiguration<$T>> {", "}",
                applicationProtocol.getOptionsType(), () -> {
            writer.addTypeImport("HttpHandlerUserInput", "__HttpHandlerUserInput", TypeScriptDependency.PROTOCOL_HTTP);
            writer.writeDocs(
                "The HTTP handler to use or its constructor options. Fetch in browser and Https in Nodejs."
            );
            writer.write("requestHandler?: __HttpHandlerUserInput;\n");

            writer.addTypeImport("HashConstructor", "__HashConstructor", TypeScriptDependency.SMITHY_TYPES);
            writer.addTypeImport("ChecksumConstructor", "__ChecksumConstructor", TypeScriptDependency.SMITHY_TYPES);
            writer.writeDocs("""
                A constructor for a class implementing the {@link @smithy/types#ChecksumConstructor} interface
                that computes the SHA-256 HMAC or checksum of a string or binary buffer.
                @internal""");
            writer.write("sha256?: __ChecksumConstructor | __HashConstructor;\n");

            writer.addTypeImport("UrlParser", "__UrlParser", TypeScriptDependency.SMITHY_TYPES);
            writer.writeDocs("The function that will be used to convert strings into HTTP endpoints.\n"
                             + "@internal");
            writer.write("urlParser?: __UrlParser;\n");

            writer.addTypeImport("BodyLengthCalculator", "__BodyLengthCalculator", TypeScriptDependency.SMITHY_TYPES);
            writer.writeDocs("A function that can calculate the length of a request body.\n"
                            + "@internal");
            writer.write("bodyLengthChecker?: __BodyLengthCalculator;\n");

            writer.addTypeImport("StreamCollector", "__StreamCollector", TypeScriptDependency.SMITHY_TYPES);
            writer.writeDocs("A function that converts a stream into an array of bytes.\n"
                            + "@internal");
            writer.write("streamCollector?: __StreamCollector;\n");

            // Note: Encoder and Decoder are both used for base64 and UTF.
            writer.addTypeImport("Encoder", "__Encoder", TypeScriptDependency.SMITHY_TYPES);
            writer.addTypeImport("Decoder", "__Decoder", TypeScriptDependency.SMITHY_TYPES);

            writer.writeDocs("The function that will be used to convert a base64-encoded string to a byte array.\n"
                            + "@internal");
            writer.write("base64Decoder?: __Decoder;\n");

            writer.writeDocs("The function that will be used to convert binary data to a base64-encoded string.\n"
                            + "@internal");
            writer.write("base64Encoder?: __Encoder;\n");

            writer.writeDocs("The function that will be used to convert a UTF8-encoded string to a byte array.\n"
                            + "@internal");
            writer.write("utf8Decoder?: __Decoder;\n");

            writer.writeDocs("The function that will be used to convert binary data to a UTF-8 encoded string.\n"
                            + "@internal");
            writer.write("utf8Encoder?: __Encoder;\n");

            writer.writeDocs("The runtime environment.\n"
                            + "@internal");
            writer.write("runtime?: string;\n");

            writer.writeDocs("Disable dynamically changing the endpoint of the client based on the hostPrefix \n"
                    + "trait of an operation.");
            writer.write("disableHostPrefix?: boolean;\n");

            // Write custom configuration dependencies.
            for (TypeScriptIntegration integration : integrations) {
                integration.addConfigInterfaceFields(settings, model, symbolProvider, writer);
            }
        }).write("");
    }

    private void generateService() {
        // Write out the service.
        writer.writeShapeDocs(service);
        writer.openBlock("export class $L extends __Client<\n"
                         + "  $T,\n"
                         + "  ServiceInputTypes,\n"
                         + "  ServiceOutputTypes,\n"
                         + "  $L\n"
                         + "> {", "}",
                symbol.getName(), applicationProtocol.getOptionsType(), resolvedConfigType, () -> {
            generateClientProperties();
            generateConstructor();
            writer.write("");
            generateDestroyMethod();
            // Hook for adding more methods to the client.
            writer.injectSection(ClientBodyExtraCodeSection.builder()
                .settings(settings)
                .model(model)
                .service(service)
                .symbolProvider(symbolProvider)
                .integrations(integrations)
                .runtimeClientPlugins(runtimePlugins)
                .applicationProtocol(applicationProtocol)
                .build());
        });
    }

    private void generateClientProperties() {
        // Hook for adding/changing client properties.
        writer.pushState(ClientPropertiesCodeSection.builder()
            .settings(settings)
            .model(model)
            .service(service)
            .symbolProvider(symbolProvider)
            .integrations(integrations)
            .applicationProtocol(applicationProtocol)
            .build());
        writer.writeDocs(String.format("The resolved configuration of %s class. This is resolved and normalized from "
                + "the {@link %s | constructor configuration interface}.", symbol.getName(), configType));
        writer.write("readonly config: $L;\n", resolvedConfigType);
        writer.popState();
    }

    private void generateConstructor() {
        writer.addTypeImport("CheckOptionalClientConfig", "__CheckOptionalClientConfig",
            TypeScriptDependency.SMITHY_TYPES);
        writer.openBlock("constructor(...[configuration]: __CheckOptionalClientConfig<$L>) {", "}", configType, () -> {
            // Hook for adding/changing the client constructor.
            writer.pushState(ClientConstructorCodeSection.builder()
                .service(service)
                .runtimeClientPlugins(runtimePlugins)
                .model(model)
                .build());

            int configVariable = 0;
            String initialConfigVar = generateConfigVariable(configVariable);
            writer.write("const $L = __getRuntimeConfig(configuration || {});",
                initialConfigVar);
            writer.write("super($L as any);", initialConfigVar);
            writer.write("this.initConfig = $L;", initialConfigVar);

            configVariable++;
            writer.addImport("resolveClientEndpointParameters", null,
                EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY);
            writer.write("const $L = $L($L);",
                generateConfigVariable(configVariable),
                "resolveClientEndpointParameters",
                generateConfigVariable(configVariable - 1));

            // Add runtime plugin "resolve" method calls. These are invoked one
            // after the other until all the runtime plugins have been called.
            // Only plugins that have configuration are called. Each time the
            // configuration is updated, the configuration variable is incremented
            // (e.g., _config_0, _config_1, etc.).
            for (RuntimeClientPlugin plugin : runtimePlugins) {
                if (plugin.getResolveFunction().isPresent()) {
                    configVariable++;
                    // Construct additional parameters string
                    Map<String, Object> paramsMap = plugin.getAdditionalResolveFunctionParameters(
                            model, service, null);
                    List<String> additionalParameters = CodegenUtils.getFunctionParametersList(paramsMap);
                    String additionalParamsString = additionalParameters.isEmpty()
                            ? ""
                            : ", { " + String.join(", ", additionalParameters) + " }";

                    // Construct writer context
                    Map<String, Object> symbolMap = new HashMap<>();
                    symbolMap.put("newConfig", generateConfigVariable(configVariable));
                    symbolMap.put("resolveFn", plugin.getResolveFunction().get());
                    symbolMap.put("oldConfig", generateConfigVariable(configVariable - 1));
                    for (Map.Entry<String, Object> entry : paramsMap.entrySet()) {
                        if (entry.getValue() instanceof Symbol) {
                            symbolMap.put(entry.getKey(), entry.getValue());
                        }
                    }
                    writer.pushState();
                    writer.putContext(symbolMap);
                    writer.write("const $newConfig:L = $resolveFn:T($oldConfig:L" + additionalParamsString + ");");
                    writer.popState();
                }
            }

            writer.addRelativeImport("resolveRuntimeExtensions", null,
                Paths.get(".", CodegenUtils.SOURCE_FOLDER, "runtimeExtensions"));

            configVariable++;
            writer.write("const $L = resolveRuntimeExtensions($L, configuration?.extensions || []);",
                generateConfigVariable(configVariable),
                generateConfigVariable(configVariable - 1));

            writer.write("this.config = $L;", generateConfigVariable(configVariable));

            if (SchemaGenerationAllowlist.allows(service.getId(), settings)) {
                writer.addImportSubmodule(
                    "getSchemaSerdePlugin", null,
                    TypeScriptDependency.SMITHY_CORE, "/schema"
                );
                writer.write("""
                this.middlewareStack.use(getSchemaSerdePlugin(this.config));""");
            }

            // Add runtime plugins that contain middleware to the middleware stack
            // of the client.
            for (RuntimeClientPlugin plugin : runtimePlugins) {
                plugin.getPluginFunction().ifPresent(pluginSymbol -> {
                    // Construct additional parameters string
                    Map<String, Object> paramsMap = plugin.getAdditionalPluginFunctionParameters(
                            model, service, null);

                    // Construct writer context
                    Map<String, Object> symbolMap = new HashMap<>();
                    symbolMap.put("pluginFn", pluginSymbol);
                    for (Map.Entry<String, Object> entry : paramsMap.entrySet()) {
                        if (entry.getValue() instanceof Symbol) {
                            symbolMap.put(entry.getKey(), entry.getValue());
                        }
                    }
                    writer.pushState();
                    writer.putContext(symbolMap);
                    writer.openBlock("this.middlewareStack.use($pluginFn:T(this.config", "));", () -> {
                        List<String> additionalParameters = CodegenUtils.getFunctionParametersList(paramsMap);
                        Map<String, ClientWriterConsumer> clientAddParamsWriterConsumers =
                            plugin.getClientAddParamsWriterConsumers();

                        if (additionalParameters.isEmpty() && clientAddParamsWriterConsumers.isEmpty()) {
                            return;
                        }

                        writer.openBlock(", {", " }", () -> {
                            // caution: using String.join instead of templating
                            // because additionalParameters may contain Smithy syntax.
                            if (!additionalParameters.isEmpty()) {
                                writer.writeInline(String.join(", ", additionalParameters) + ", ");
                            }
                            clientAddParamsWriterConsumers.forEach((key, consumer) -> {
                                writer.writeInline("$L: $C,", key, (Consumer<TypeScriptWriter>) (w -> {
                                    consumer.accept(w, ClientBodyExtraCodeSection.builder()
                                        .settings(settings)
                                        .model(model)
                                        .service(service)
                                        .symbolProvider(symbolProvider)
                                        .integrations(integrations)
                                        .runtimeClientPlugins(runtimePlugins)
                                        .applicationProtocol(applicationProtocol)
                                        .build());
                                }));
                            });
                        });
                    });
                    writer.popState();
                });
            }
            writer.popState();
        });
    }

    private String generateConfigVariable(int number) {
        return "_config_" + number;
    }

    private void generateDestroyMethod() {
        // Generates the destroy() method, and calls the destroy() method of
        // any runtime plugin that claims to have a destroy method.
        if (applicationProtocol.isHttpProtocol()) {
            writer.writeDocs("Destroy underlying resources, like sockets. It's usually not necessary to do this.\n"
                    + "However in Node.js, it's best to explicitly shut down the client's agent when it is no longer "
                    + "needed.\nOtherwise, sockets might stay open for quite a long time before the server terminates "
                    + "them.");
        }
        writer.openBlock("destroy(): void {", "}", () -> {
            writer.pushState(ClientDestroyCodeSection.builder()
                .runtimeClientPlugins(runtimePlugins)
                .build());
            for (RuntimeClientPlugin plugin : runtimePlugins) {
                plugin.getDestroyFunction().ifPresent(destroy -> {
                    writer.write("$T(this.config);", destroy);
                });
            }
            writer.popState();
            // Always call destroy() in SmithyClient class. By default, it's optional.
            writer.write("super.destroy();");
        });
    }
}
