/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.nio.file.Paths;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates server operation types.
 */
@SmithyInternalApi
final class ServerCommandGenerator implements Runnable {

    static final String COMMANDS_FOLDER = "operations";
    private static final String NO_PROTOCOL_FOUND_SERDE_FUNCTION =
            "(async (...args: any[]) => { throw new Error(\"No supported protocol was found\"); })";

    private final TypeScriptSettings settings;
    private final Model model;
    private final OperationShape operation;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final OperationIndex operationIndex;
    private final Symbol inputType;
    private final Symbol outputType;
    private final Symbol errorsType;
    private final ProtocolGenerator protocolGenerator;
    private final ApplicationProtocol applicationProtocol;
    private final List<StructureShape> errors;

    ServerCommandGenerator(
            TypeScriptSettings settings,
            Model model,
            OperationShape operation,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            ProtocolGenerator protocolGenerator,
            ApplicationProtocol applicationProtocol
    ) {
        this.settings = settings;
        this.model = model;
        this.operation = operation;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.protocolGenerator = protocolGenerator;
        this.applicationProtocol = applicationProtocol;

        Symbol operationSymbol = symbolProvider.toSymbol(operation);
        operationIndex = OperationIndex.of(model);
        inputType = operationSymbol.expectProperty("inputType", Symbol.class);
        outputType = operationSymbol.expectProperty("outputType", Symbol.class);
        errorsType = operationSymbol.expectProperty("errorsType", Symbol.class);
        errors = Collections.unmodifiableList(operationIndex.getErrors(operation, settings.getService()));
    }

    @Override
    public void run() {
        writeOperationType();
        addInputAndOutputTypes();
        writeErrorType();
        writeOperationSerializer();
    }

    private void addInputAndOutputTypes() {
        writeInputType(inputType.getName(), operationIndex.getInput(operation));
        writeOutputType(outputType.getName(), operationIndex.getOutput(operation));
        writer.write("");
    }

    private void writeInputType(String typeName, Optional<StructureShape> inputShape) {
        if (inputShape.isPresent()) {
            StructureShape input = inputShape.get();
            writer.write("export interface $L extends $T {}", typeName, symbolProvider.toSymbol(inputShape.get()));
            renderNamespace(typeName, input);
        } else {
            // If the input is non-existent, then use an empty object.
            writer.write("export interface $L {}", typeName);
            writer.openBlock("export namespace $L {", "}", typeName, () -> {
                writer.addImport("ValidationFailure", "__ValidationFailure", TypeScriptDependency.SERVER_COMMON);
                writer.writeDocs("@internal");
                writer.write("export const validate: () => __ValidationFailure[] = () => [];");
            });
        }
    }

    private void renderNamespace(String typeName, StructureShape input) {
        Symbol symbol = symbolProvider.toSymbol(input);
        writer.openBlock("export namespace $L {", "}", typeName, () -> {
            writer.addImport("ValidationFailure", "__ValidationFailure", TypeScriptDependency.SERVER_COMMON);
            writer.writeDocs("@internal");
            // Streaming makes the type of the object being validated weird on occasion.
            // Using `Parameters` here means we don't have to try to derive the weird type twice
            writer.write("export const validate: (obj: Parameters<typeof $1T.validate>[0]) => "
                    + "__ValidationFailure[] = $1T.validate;", symbol);
        });
    }

    private void writeOutputType(String typeName, Optional<StructureShape> outputShape) {
        if (outputShape.isPresent()) {
            writer.write("export interface $L extends $T {}",
                    typeName,
                    symbolProvider.toSymbol(outputShape.get()));
        } else {
            writer.write("export interface $L {}", typeName);
        }
    }

    private void writeErrorType() {
        if (errors.isEmpty()) {
            writer.write("export type $L = never;", errorsType.getName());
        } else {
            writer.writeInline("export type $L = ", errorsType.getName());
            for (Iterator<StructureShape> iter = errors.iterator(); iter.hasNext();) {
                writer.writeInline("$T", symbolProvider.toSymbol(iter.next()));
                if (iter.hasNext()) {
                    writer.writeInline(" | ");
                }
            }
            writer.write("");
        }
        writer.write("");
    }

    private void writeOperationType() {
        Symbol operationSymbol = symbolProvider.toSymbol(operation);
        writer.addImport("Operation", "__Operation", TypeScriptDependency.SERVER_COMMON);
        writer.write("export type $L<Context> = __Operation<$T, $T, Context>",
                operationSymbol.getName(),
                inputType,
                outputType);
        writer.write("");
    }

    private void writeOperationSerializer() {
        Symbol operationSymbol = symbolProvider.toSymbol(operation);
        String serializerName = operationSymbol.expectProperty("serializerType", Symbol.class).getName();
        Symbol serverSymbol = symbolProvider.toSymbol(model.expectShape(settings.getService()));

        writer.addImport("OperationSerializer", "__OperationSerializer", TypeScriptDependency.SERVER_COMMON);
        writer.openBlock("export class $L implements __OperationSerializer<$T<any>, $S, $T> {",
                "}",
                serializerName,
                serverSymbol,
                operationSymbol.getName(),
                errorsType,
                () -> {
                    if (protocolGenerator == null) {
                        writer.write("serialize = $L as any;", NO_PROTOCOL_FOUND_SERDE_FUNCTION);
                        writer.write("deserialize = $L as any;", NO_PROTOCOL_FOUND_SERDE_FUNCTION);
                    } else {
                        String serializerFunction =
                                ProtocolGenerator.getGenericSerFunctionName(operationSymbol) + "Response";
                        writer.addRelativeImport(serializerFunction,
                                null,
                                Paths.get(".",
                                        CodegenUtils.SOURCE_FOLDER,
                                        ProtocolGenerator.PROTOCOLS_FOLDER,
                                        ProtocolGenerator.getSanitizedName(protocolGenerator.getName())));
                        writer.write("serialize = $L;", serializerFunction);
                        String deserializerFunction =
                                ProtocolGenerator.getGenericDeserFunctionName(operationSymbol) + "Request";
                        writer.addRelativeImport(deserializerFunction,
                                null,
                                Paths.get(".",
                                        CodegenUtils.SOURCE_FOLDER,
                                        ProtocolGenerator.PROTOCOLS_FOLDER,
                                        ProtocolGenerator.getSanitizedName(protocolGenerator.getName())));
                        writer.write("deserialize = $L;", deserializerFunction);
                    }
                    writer.write("");
                    writeErrorChecker();
                    writeErrorHandler();
                });
        writer.write("");
    }

    private void writeErrorChecker() {
        writer.openBlock("isOperationError(error: any): error is $T {", "};", errorsType, () -> {
            if (errors.isEmpty()) {
                writer.write("return false;");
            } else {
                writer.writeInline("const names: $T['name'][] = [", errorsType);
                for (Iterator<StructureShape> iter = errors.iterator(); iter.hasNext();) {
                    writer.writeInline("$S", iter.next().getId().getName());
                    if (iter.hasNext()) {
                        writer.writeInline(", ");
                    }
                }
                writer.write("];");
                writer.write("return names.includes(error.name);");
            }
        });
        writer.write("");
    }

    private void writeErrorHandler() {
        writer.addImport("ServerSerdeContext", null, TypeScriptDependency.SERVER_COMMON);
        writer.openBlock("serializeError(error: $T, ctx: ServerSerdeContext): Promise<$T> {",
                "}",
                errorsType,
                applicationProtocol.getResponseType(),
                () -> {
                    if (errors.isEmpty()) {
                        writer.write("throw error;");
                    } else {
                        writer.openBlock("switch (error.name) {", "}", () -> {
                            for (StructureShape error : errors) {
                                writeErrorHandlerCase(error);
                            }
                            writer.openBlock("default: {", "}", () -> writer.write("throw error;"));
                        });
                    }
                });
        writer.write("");
    }

    private void writeErrorHandlerCase(StructureShape error) {
        Symbol errorSymbol = symbolProvider.toSymbol(error);
        writer.openBlock("case $S: {", "}", error.getId().getName(), () -> {
            if (protocolGenerator == null) {
                writer.write("return $L(error, ctx);", NO_PROTOCOL_FOUND_SERDE_FUNCTION);
            } else {
                String serializerFunction = ProtocolGenerator.getGenericSerFunctionName(errorSymbol) + "Error";
                writer.addRelativeImport(serializerFunction,
                        null,
                        Paths.get(".",
                                CodegenUtils.SOURCE_FOLDER,
                                ProtocolGenerator.PROTOCOLS_FOLDER,
                                ProtocolGenerator.getSanitizedName(protocolGenerator.getName())));
                writer.write("return $L(error, ctx);", serializerFunction);
            }
        });
    }

    static void writeIndex(
            Model model,
            ServiceShape service,
            SymbolProvider symbolProvider,
            FileManifest fileManifest
    ) {
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
                Paths.get(CodegenUtils.SOURCE_FOLDER, ServerSymbolVisitor.SERVER_FOLDER, COMMANDS_FOLDER, "index.ts")
                        .toString(),
                writer.toString());
    }
}
