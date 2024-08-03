/*
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import static software.amazon.smithy.typescript.codegen.CodegenUtils.getBlobPayloadMembers;
import static software.amazon.smithy.typescript.codegen.CodegenUtils.getBlobStreamingMembers;
import static software.amazon.smithy.typescript.codegen.CodegenUtils.writeClientCommandBlobPayloadInputType;
import static software.amazon.smithy.typescript.codegen.CodegenUtils.writeClientCommandBlobPayloadOutputType;
import static software.amazon.smithy.typescript.codegen.CodegenUtils.writeClientCommandStreamingInputType;
import static software.amazon.smithy.typescript.codegen.CodegenUtils.writeClientCommandStreamingOutputType;

import java.nio.file.Paths;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.DeprecatedTrait;
import software.amazon.smithy.model.traits.DocumentationTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.InternalTrait;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.documentation.StructureExampleGenerator;
import software.amazon.smithy.typescript.codegen.endpointsV2.RuleSetParameterFinder;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.sections.CommandBodyExtraCodeSection;
import software.amazon.smithy.typescript.codegen.sections.CommandConstructorCodeSection;
import software.amazon.smithy.typescript.codegen.sections.CommandPropertiesCodeSection;
import software.amazon.smithy.typescript.codegen.sections.PreCommandClassCodeSection;
import software.amazon.smithy.typescript.codegen.sections.SmithyContextCodeSection;
import software.amazon.smithy.typescript.codegen.util.CommandWriterConsumer;
import software.amazon.smithy.typescript.codegen.validation.SensitiveDataFinder;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates a client command using plugins.
 */
@SmithyInternalApi
final class CommandGenerator implements Runnable {

    static final String COMMANDS_FOLDER = "commands";

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final OperationShape operation;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final Symbol symbol;
    private final List<RuntimeClientPlugin> runtimePlugins;
    private final OperationIndex operationIndex;
    private final Symbol inputType;
    private final Symbol outputType;
    private final ProtocolGenerator protocolGenerator;
    private final ApplicationProtocol applicationProtocol;
    private final SensitiveDataFinder sensitiveDataFinder;

    CommandGenerator(
            TypeScriptSettings settings,
            Model model,
            OperationShape operation,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            List<RuntimeClientPlugin> runtimePlugins,
            ProtocolGenerator protocolGenerator,
            ApplicationProtocol applicationProtocol) {
        this.settings = settings;
        this.model = model;
        this.service = settings.getService(model);
        this.operation = operation;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.runtimePlugins = runtimePlugins.stream()
                .filter(plugin -> plugin.matchesOperation(model, service, operation))
                .collect(Collectors.toList());
        this.protocolGenerator = protocolGenerator;
        this.applicationProtocol = applicationProtocol;
        sensitiveDataFinder = new SensitiveDataFinder(model);

        symbol = symbolProvider.toSymbol(operation);
        operationIndex = OperationIndex.of(model);
        inputType = symbol.expectProperty("inputType", Symbol.class);
        outputType = symbol.expectProperty("outputType", Symbol.class);
    }

    @Override
    public void run() {
        addInputAndOutputTypes();
        generateClientCommand();
    }

    private void generateClientCommand() {
        Symbol serviceSymbol = symbolProvider.toSymbol(service);
        String configType = ServiceBareBonesClientGenerator.getResolvedConfigTypeName(serviceSymbol);

        // Add required imports.
        writer.addRelativeImport(configType, null, Paths.get(".", serviceSymbol.getNamespace()));
        writer.addRelativeImport("ServiceInputTypes", null, Paths.get(".", serviceSymbol.getNamespace()));
        writer.addRelativeImport("ServiceOutputTypes", null, Paths.get(".", serviceSymbol.getNamespace()));
        writer.addImport("Command", "$Command", TypeScriptDependency.AWS_SMITHY_CLIENT);

        String name = symbol.getName();

        StringBuilder additionalDocs = new StringBuilder()
                .append("\n")
                .append(getCommandExample(
                        serviceSymbol.getName(), configType, name, inputType.getName(), outputType.getName()))
                .append("\n")
                .append(getThrownExceptions());

        boolean operationHasDocumentation = operation.hasTrait(DocumentationTrait.class);

        if (operationHasDocumentation) {
            writer.writeShapeDocs(
                operation,
                shapeDoc -> shapeDoc + additionalDocs
            );
        } else {
            boolean isPublic = !operation.hasTrait(InternalTrait.class);
            boolean isDeprecated = operation.hasTrait(DeprecatedTrait.class);

            writer.writeDocs(
                (isPublic ? "@public\n" : "@internal\n")
                + (isDeprecated ? "@deprecated\n" : "")
                + additionalDocs
            );
        }

        // Section of items like TypeScript @ts-ignore
        writer.injectSection(PreCommandClassCodeSection.builder()
            .settings(settings)
            .model(model)
            .service(service)
            .operation(operation)
            .symbolProvider(symbolProvider)
            .runtimeClientPlugins(runtimePlugins)
            .protocolGenerator(protocolGenerator)
            .applicationProtocol(applicationProtocol)
            .build());
        writer.openBlock(
            "export class $L extends $$Command.classBuilder<$T, $T, $L, ServiceInputTypes, ServiceOutputTypes>()",
            ".build() {", // class open bracket.
            name, inputType, outputType, configType,
            () -> {
                generateEndpointParameterInstructionProvider();
                generateCommandMiddlewareResolver(configType);
                writeSerde();
            });
        // Ctor section.
        writer.injectSection(CommandConstructorCodeSection.builder()
            .settings(settings)
            .model(model)
            .service(service)
            .operation(operation)
            .symbolProvider(symbolProvider)
            .runtimeClientPlugins(runtimePlugins)
            .protocolGenerator(protocolGenerator)
            .applicationProtocol(applicationProtocol)
            .build());
        // Section for adding custom command properties.
        writer.injectSection(CommandPropertiesCodeSection.builder()
            .settings(settings)
            .model(model)
            .service(service)
            .operation(operation)
            .symbolProvider(symbolProvider)
            .runtimeClientPlugins(runtimePlugins)
            .protocolGenerator(protocolGenerator)
            .applicationProtocol(applicationProtocol)
            .build());
        // Hook for adding more methods to the command.
        writer.injectSection(CommandBodyExtraCodeSection.builder()
            .settings(settings)
            .model(model)
            .service(service)
            .operation(operation)
            .symbolProvider(symbolProvider)
            .runtimeClientPlugins(runtimePlugins)
            .protocolGenerator(protocolGenerator)
            .applicationProtocol(applicationProtocol)
            .build());
        writer.write("}"); // class close bracket.
    }

    private String getCommandExample(String serviceName, String configName, String commandName, String commandInput,
            String commandOutput) {
        String packageName = settings.getPackageName();
        return "@example\n"
                + "Use a bare-bones client and the command you need to make an API call.\n"
                + "```javascript\n"
                + String.format("import { %s, %s } from \"%s\"; // ES Modules import%n", serviceName, commandName,
                        packageName)
                + String.format("// const { %s, %s } = require(\"%s\"); // CommonJS import%n", serviceName, commandName,
                        packageName)
                + String.format("const client = new %s(config);%n", serviceName)
                + String.format("const input = %s%n",
                        StructureExampleGenerator.generateStructuralHintDocumentation(
                                model.getShape(operation.getInputShape()).get(), model, false, true))
                + String.format("const command = new %s(input);%n", commandName)
                + "const response = await client.send(command);\n"
                + String.format("%s%n",
                        StructureExampleGenerator.generateStructuralHintDocumentation(
                                model.getShape(operation.getOutputShape()).get(), model, true, false))
                + "\n```\n"
                + "\n"
                + String.format("@param %s - {@link %s}%n", commandInput, commandInput)
                + String.format("@returns {@link %s}%n", commandOutput)
                + String.format("@see {@link %s} for command's `input` shape.%n", commandInput)
                + String.format("@see {@link %s} for command's `response` shape.%n", commandOutput)
                + String.format("@see {@link %s | config} for %s's `config` shape.%n", configName, serviceName);
    }

    private String getThrownExceptions() {
        List<ShapeId> errors = operation.getErrors();
        StringBuilder buffer = new StringBuilder();
        for (ShapeId error : errors) {
            Shape errorShape = model.getShape(error).get();
            Optional<DocumentationTrait> doc = errorShape.getTrait(DocumentationTrait.class);
            ErrorTrait errorTrait = errorShape.getTrait(ErrorTrait.class).get();

            if (doc.isPresent()) {
                buffer.append(String.format("@throws {@link %s} (%s fault)%n %s",
                        error.getName(), errorTrait.getValue(), doc.get().getValue()));
            } else {
                buffer.append(String.format("@throws {@link %s} (%s fault)",
                        error.getName(), errorTrait.getValue()));
            }
            buffer.append("\n\n");
        }

        String name = CodegenUtils.getServiceName(settings, model, symbolProvider);
        buffer.append(String.format("@throws {@link %s}%n", CodegenUtils.getServiceExceptionName(name)));
        buffer.append(String.format("<p>Base exception class for all service exceptions from %s service.</p>%n", name));

        return buffer.toString();
    }

    private void generateEndpointParameterInstructionProvider() {
        if (!service.hasTrait(EndpointRuleSetTrait.class)) {
            return;
        }
        writer.write(".ep({")
            .indent();
        {
            writer.addImport(
                "commonParams", null,
                Paths.get(".", CodegenUtils.SOURCE_FOLDER, "endpoint/EndpointParameters").toString()
            );

            writer.write("...commonParams,");

            RuleSetParameterFinder parameterFinder = new RuleSetParameterFinder(service);
            Set<String> paramNames = new HashSet<>();

            parameterFinder.getStaticContextParamValues(operation).forEach((name, value) -> {
                paramNames.add(name);
                writer.write(
                    "$L: { type: \"staticContextParams\", value: $L },",
                    name, value);
            });

            Shape operationInput = model.getShape(operation.getInputShape()).get();
            parameterFinder.getContextParams(operationInput).forEach((name, type) -> {
                if (!paramNames.contains(name)) {
                    writer.write(
                        "$L: { type: \"contextParams\", name: \"$L\" },",
                        name, name);
                }
                paramNames.add(name);
            });
        }
        writer.write("})")
            .dedent();
    }

    private void generateCommandMiddlewareResolver(String configType) {
        Symbol serde = TypeScriptDependency.MIDDLEWARE_SERDE.createSymbol("getSerdePlugin");

        Function<StructureShape, String> getFilterFunctionName = input -> {
            if (sensitiveDataFinder.findsSensitiveDataIn(input)) {
                Symbol inputSymbol = symbolProvider.toSymbol(input);
                String filterFunctionName = inputSymbol.getName() + "FilterSensitiveLog";
                writer.addRelativeImport(
                    filterFunctionName,
                    null,
                    Paths.get(".", inputSymbol.getNamespace()));
                return filterFunctionName;
            }
            return "void 0";
        };
        String inputFilterFn = operationIndex
            .getInput(operation)
            .map(getFilterFunctionName)
            .orElse("void 0");

        String outputFilterFn = operationIndex
            .getOutput(operation)
            .map(getFilterFunctionName)
            .orElse("void 0");

        writer.pushState()
            .putContext("client", symbolProvider.toSymbol(service).getName())
            .putContext("command", symbolProvider.toSymbol(operation).getName())
            .putContext("service", service.toShapeId().getName())
            .putContext("operation", operation.toShapeId().getName())
            .putContext("inputFilter", inputFilterFn)
            .putContext("outputFilter", outputFilterFn)
            .putContext("configType", configType)
            .putContext("optionsType", applicationProtocol.getOptionsType())
            .putContext("inputType", inputType)
            .putContext("outputType", outputType);

        writer.write(
            """
                .m(function (this: any, Command: any, cs: any, config: $configType:L, o: any) {
                    return [
            """
        );
        {
            // Add serialization and deserialization plugin.
            writer.write("$T(config, this.serialize, this.deserialize),", serde);
            // EndpointsV2
            if (service.hasTrait(EndpointRuleSetTrait.class)) {
                writer.addImport(
                    "getEndpointPlugin",
                    null,
                    TypeScriptDependency.MIDDLEWARE_ENDPOINTS_V2);
                writer.write(
                    """
                    getEndpointPlugin(config, Command.getEndpointParameterInstructions()),"""
                );
            }
            // Add customizations.
            addCommandSpecificPlugins();
        }
        writer.write(
            """
                ];
            })"""
        ); // end middleware.

        // context, filters
        writer.openBlock(
            """
            .s($service:S, $operation:S, {
            """,
            """
            })
            .n($client:S, $command:S)
            .f($inputFilter:L, $outputFilter:L)""",
            () -> {
                writer.pushState(SmithyContextCodeSection.builder()
                    .settings(settings)
                    .model(model)
                    .service(service)
                    .operation(operation)
                    .symbolProvider(symbolProvider)
                    .runtimeClientPlugins(runtimePlugins)
                    .protocolGenerator(protocolGenerator)
                    .applicationProtocol(applicationProtocol)
                    .build());
                writer.popState();
            }
        );
        writer.popState();
    }

    private void addInputAndOutputTypes() {
        writer.writeDocs("@public");
        writer.write("export type { __MetadataBearer };");
        writer.write("export { $$Command };");

        writeInputType(inputType.getName(), operationIndex.getInput(operation), symbol.getName());
        writeOutputType(outputType.getName(), operationIndex.getOutput(operation), symbol.getName());
        writer.write("");
    }

    private void writeInputType(String typeName, Optional<StructureShape> inputShape, String commandName) {
        if (inputShape.isPresent()) {
            StructureShape input = inputShape.get();
            List<MemberShape> blobStreamingMembers = getBlobStreamingMembers(model, input);
            List<MemberShape> blobPayloadMembers = getBlobPayloadMembers(model, input);

            if (!blobStreamingMembers.isEmpty()) {
                writeClientCommandStreamingInputType(
                    writer, symbolProvider.toSymbol(input), typeName,
                    blobStreamingMembers.get(0), commandName
                );
            } else if (!blobPayloadMembers.isEmpty()) {
                writeClientCommandBlobPayloadInputType(
                    writer, symbolProvider.toSymbol(input), typeName,
                    blobPayloadMembers.get(0), commandName
                );
            } else {
                writer.writeDocs("@public\n\nThe input for {@link " + commandName + "}.");
                writer.write("export interface $L extends $T {}", typeName, symbolProvider.toSymbol(input));
            }
        } else {
            // If the input is non-existent, then use an empty object.
            writer.writeDocs("@public\n\nThe input for {@link " + commandName + "}.");
            writer.write("export interface $L {}", typeName);
        }
    }

    private void writeOutputType(String typeName, Optional<StructureShape> outputShape, String commandName) {
        // Output types should always be MetadataBearers, possibly in addition
        // to a defined output shape.
        writer.addImport("MetadataBearer", "__MetadataBearer", TypeScriptDependency.SMITHY_TYPES);
        if (outputShape.isPresent()) {
            StructureShape output = outputShape.get();
            List<MemberShape> blobStreamingMembers = getBlobStreamingMembers(model, output);
            List<MemberShape> blobPayloadMembers = getBlobPayloadMembers(model, output);

            if (!blobStreamingMembers.isEmpty()) {
                writeClientCommandStreamingOutputType(
                    writer, symbolProvider.toSymbol(output), typeName,
                    blobStreamingMembers.get(0), commandName
                );
            } else if (!blobPayloadMembers.isEmpty()) {
                writeClientCommandBlobPayloadOutputType(
                    writer, symbolProvider.toSymbol(output), typeName,
                    blobPayloadMembers.get(0), commandName
                );
            } else {
                writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
                writer.write("export interface $L extends $T, __MetadataBearer {}",
                        typeName, symbolProvider.toSymbol(outputShape.get()));
            }
        } else {
            writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
            writer.write("export interface $L extends __MetadataBearer {}", typeName);
        }
    }

    private void addCommandSpecificPlugins() {
        // Some plugins might only apply to specific commands. They are added to the
        // command's middleware stack here. Plugins that apply to all commands are
        // applied automatically when the Command's middleware stack is copied from
        // the service's middleware stack.
        for (RuntimeClientPlugin plugin : runtimePlugins) {
            plugin.getPluginFunction().ifPresent(pluginSymbol -> {
                // Construct additional parameters string
                Map<String, Object> paramsMap = plugin.getAdditionalPluginFunctionParameters(
                        model, service, operation);


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
                writer.openBlock("$pluginFn:T(config", "),", () -> {
                    List<String> additionalParameters = CodegenUtils.getFunctionParametersList(paramsMap);
                    Map<String, CommandWriterConsumer> clientAddParamsWriterConsumers =
                        plugin.getOperationAddParamsWriterConsumers();
                    if (additionalParameters.isEmpty() && clientAddParamsWriterConsumers.isEmpty()) {
                        return;
                    }
                    writer.openBlock(", { ", " }", () -> {
                        // caution: using String.join instead of templating
                        // because additionalParameters may contain Smithy syntax.
                        if (!additionalParameters.isEmpty()) {
                            writer.writeInline(String.join(", ", additionalParameters) + ", ");
                        }
                        clientAddParamsWriterConsumers.forEach((key, consumer) -> {
                            writer.writeInline("$L: $C,", key, (Consumer<TypeScriptWriter>) (w -> {
                                consumer.accept(w, CommandConstructorCodeSection.builder()
                                    .settings(settings)
                                    .model(model)
                                    .service(service)
                                    .symbolProvider(symbolProvider)
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
    }

    private void writeSerde() {
        writer
            .write(".ser($L)", getSerdeDispatcher(true))
            .write(".de($L)", getSerdeDispatcher(false));
    }

    private String getSerdeDispatcher(boolean isInput) {
        if (protocolGenerator == null) {
            return "() => { throw new Error(\"No supported protocol was found\"); }";
        } else {
            String serdeFunctionName = isInput
                    ? ProtocolGenerator.getSerFunctionShortName(symbol)
                    : ProtocolGenerator.getDeserFunctionShortName(symbol);
            writer.addRelativeImport(serdeFunctionName, null,
                    Paths.get(".", CodegenUtils.SOURCE_FOLDER, ProtocolGenerator.PROTOCOLS_FOLDER,
                            ProtocolGenerator.getSanitizedName(protocolGenerator.getName())));
            return serdeFunctionName;
        }
    }

    static void writeIndex(
            Model model,
            ServiceShape service,
            SymbolProvider symbolProvider,
            FileManifest fileManifest) {
        TypeScriptWriter writer = new TypeScriptWriter("");

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(service));
        if (containedOperations.isEmpty()) {
            writer.write("export {};");
        } else {
            for (OperationShape operation : containedOperations) {
                writer.write("export * from \"./$L\";", symbolProvider.toSymbol(operation).getName());
            }
        }

        fileManifest.writeFile(
                Paths.get(CodegenUtils.SOURCE_FOLDER, CommandGenerator.COMMANDS_FOLDER, "index.ts").toString(),
                writer.toString());
    }
}
