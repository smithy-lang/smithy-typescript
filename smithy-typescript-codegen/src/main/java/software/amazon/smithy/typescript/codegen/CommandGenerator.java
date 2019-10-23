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
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.utils.StringUtils;

/**
 * Generates a client command using plugins.
 */
final class CommandGenerator implements Runnable {

    static final String COMMAND_PROPERTIES_SECTION = "command_properties";
    static final String COMMAND_BODY_EXTRA_SECTION = "command_body_extra";
    static final String COMMAND_CONSTRUCTOR_SECTION = "command_constructor";

    private static final String MIDDLEWARE_SERDE_VERSION = "^0.1.0-preview.1";

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final OperationShape operation;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final Symbol symbol;
    private final List<RuntimeClientPlugin> runtimePlugins;
    private final OperationIndex operationIndex;
    private final String inputType;
    private final String outputType;
    private final ApplicationProtocol applicationProtocol;

    CommandGenerator(
            TypeScriptSettings settings,
            Model model,
            ServiceShape service,
            OperationShape operation,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            List<RuntimeClientPlugin> runtimePlugins,
            ApplicationProtocol applicationProtocol
    ) {
        this.settings = settings;
        this.model = model;
        this.service = service;
        this.operation = operation;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.runtimePlugins = runtimePlugins.stream()
                .filter(plugin -> plugin.getOperationNames().contains(operation.getId().getName()))
                .collect(Collectors.toList());
        this.applicationProtocol = applicationProtocol;

        symbol = symbolProvider.toSymbol(operation);
        operationIndex = model.getKnowledge(OperationIndex.class);
        inputType = symbol.getName() + "Input";
        outputType = symbol.getName() + "Output";
    }

    @Override
    public void run() {
        Symbol serviceSymbol = symbolProvider.toSymbol(service);
        String configType = ServiceGenerator.getResolvedConfigTypeName(serviceSymbol);

        // Add required imports.
        writer.addImport(configType, configType, serviceSymbol.getNamespace());
        writer.addImport("ServiceInputTypes", "ServiceInputTypes", serviceSymbol.getNamespace());
        writer.addImport("ServiceOutputTypes", "ServiceOutputTypes", serviceSymbol.getNamespace());
        writer.addImport("Command", "$Command", "@aws-sdk/smithy-client");
        writer.addImport("*", "$types", "@aws-sdk/types");

        addInputAndOutputTypes();

        // This "Utils" type is used when serializing and deserializing commands. It
        // provides various platform specific methods that serde needs.
        writer.write("type Utils = { [key: string]: any };").write("");

        String name = symbol.getName();
        writer.openBlock("export class $L extends $$Command<$L, $L> {", "}", name, inputType, outputType, () -> {

            // Section for adding custom command properties.
            writer.write("// Start section: $L", COMMAND_PROPERTIES_SECTION);
            writer.pushState(COMMAND_PROPERTIES_SECTION).popState();
            writer.write("// End section: $L", COMMAND_PROPERTIES_SECTION);
            writer.write("");

            generateCommandConstructor();
            writer.write("");
            generateCommandMiddlewareResolver(configType);
            writeSerde();

            // Hook for adding more methods to the command.
            writer.write("// Start section: $L", COMMAND_BODY_EXTRA_SECTION)
                    .pushState(COMMAND_BODY_EXTRA_SECTION)
                    .popState()
                    .write("// End section: $L", COMMAND_BODY_EXTRA_SECTION);
        });
    }

    private void generateCommandConstructor() {
        writer.openBlock("constructor(readonly input: $L) {", "}", inputType, () -> {
            // The constructor can be intercepted and changed.
            writer.write("// Start section: $L", COMMAND_CONSTRUCTOR_SECTION)
                    .pushState(COMMAND_CONSTRUCTOR_SECTION)
                    .write("super();")
                    .popState()
                    .write("// Start section: $L", COMMAND_CONSTRUCTOR_SECTION);
        });
    }

    private void generateCommandMiddlewareResolver(String configType) {
        Symbol ser = Symbol.builder()
                .name("serializerPlugin")
                .namespace("@aws-sdk/middleware-serde", "/")
                .build();
        Symbol deser = Symbol.builder()
                .name("deserializerPlugin")
                .namespace("@aws-sdk/middleware-serde", "/")
                .addDependency(PackageJsonGenerator.NORMAL_DEPENDENCY,
                               "@aws-sdk/middleware-serde",
                               MIDDLEWARE_SERDE_VERSION)
                .build();

        writer.write("resolveMiddleware(")
                .indent()
                .write("clientStack: $$types.MiddlewareStack<$L, $L>,", inputType, outputType)
                .write("configuration: $L,", configType)
                .write("options?: $T", applicationProtocol.getOptionsType())
                .dedent();
        writer.openBlock("): $$types.Handler<$L, $L> {", "}", inputType, outputType, () -> {
            // Add serialization and deserialization plugins.
            writer.write("this.use($T(configuration, this.serialize));", ser);
            writer.write("this.use($T<$L>(configuration, this.deserialize));", deser, outputType);

            // Add customizations.
            addCommandSpecificPlugins();

            // Resolve the middleware stack.
            writer.write("\nconst stack = clientStack.concat(this.middlewareStack);\n");
            writer.openBlock("const handlerExecutionContext: $$types.HandlerExecutionContext = {", "}", () -> {
                writer.write("logger: {} as any,");
            });
            writer.write("const { httpHandler } = configuration;");
            writer.openBlock("return stack.resolve(", ");", () -> {
                writer.write("(request: $$types.FinalizeHandlerArguments<any>) => ");
                writer.write("  httpHandler.handle(request.request as $T, options || {}),",
                             applicationProtocol.getRequestType());
                writer.write("handlerExecutionContext");
            });
        });
    }

    private void addInputAndOutputTypes() {
        writeInputOrOutputType(inputType, operationIndex.getInput(operation).orElse(null));
        writeInputOrOutputType(outputType, operationIndex.getOutput(operation).orElse(null));
        writer.write("");
    }

    private void writeInputOrOutputType(String typeName, StructureShape struct) {
        // If the input or output are non-existent, then use an empty object.
        if (struct == null) {
            writer.write("export type $L = {};", typeName);
        } else {
            writer.write("export type $L = $T;", typeName, symbolProvider.toSymbol(struct));
        }
    }

    private void addCommandSpecificPlugins() {
        // Some plugins might only apply to specific commands. They are added to the
        // command's middleware stack here. Plugins that apply to all commands are
        // applied automatically when the Command's middleware stack is copied from
        // the service's middleware stack.
        for (RuntimeClientPlugin plugin : runtimePlugins) {
            if (plugin.hasMiddleware() && plugin.getOperationNames().contains(operation.getId().getName())) {
                writer.write("this.use($T.getMiddleware(configuration));", plugin.getSymbol());
            }
        }
    }

    private void writeSerde() {
        writer.write("")
                .write("private serialize(")
                .indent()
                    .write("input: $L,", inputType)
                    .write("protocol: string,")
                    .write("utils?: Utils")
                .dedent()
                .openBlock("): $T {", "}", applicationProtocol.getRequestType(), () -> writeSerdeDispatcher("input"));

        writer.write("")
                .write("private deserialize(")
                .indent()
                    .write("output: $T,", applicationProtocol.getResponseType())
                    .write("protocol: string,")
                    .write("utils?: Utils")
                .dedent()
                .openBlock("): Promise<$L> {", "}", outputType, () -> writeSerdeDispatcher("output"))
                .write("");
    }

    private void writeSerdeDispatcher(String inputOrOutput) {
        writer.openBlock("switch (protocol) {", "}", () -> {
            // Generate case statements for each supported protocol.
            // For example:
            // case 'aws.rest-json-1.1':
            //   return getFooCommandAws_RestJson1_1Serialize(input, utils);
            //
            for (String protocol : settings.getProtocols()) {
                String serdeFunctionName = getSerdeFunctionName(symbol, protocol, inputOrOutput);
                writer.write("case '$L':", protocol)
                        .write("  return $L($L, utils);", serdeFunctionName, inputOrOutput);
            }

            writer.write("default:")
                    .write("  throw new Error(\"Unknown protocol, \" + protocol + \". Expected one of: $L\");",
                           settings.getProtocols());
        });
    }

    private static String getSerdeFunctionName(Symbol commandSymbol, String protocol, String inputOrOutput) {
        String functionName = StringUtils.uncapitalize(commandSymbol.getName());
        functionName += ProtocolGenerator.getSanitizedName(protocol);

        if (inputOrOutput.equals("input")) {
            functionName += "Serialize";
        } else {
            functionName += "Deserialize";
        }

        return functionName;
    }
}
