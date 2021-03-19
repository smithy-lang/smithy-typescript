/*
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import static software.amazon.smithy.typescript.codegen.CodegenUtils.getBlobStreamingMembers;
import static software.amazon.smithy.typescript.codegen.CodegenUtils.writeStreamingMemberType;

import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

/**
 * Generates server operation types.
 */
final class ServerCommandGenerator implements Runnable {

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

    // TODO: Flip these so that metadata is attached to input and streaming customization is attached to output.
    private void writeInputType(String typeName, Optional<StructureShape> inputShape) {
        if (inputShape.isPresent()) {
            StructureShape input = inputShape.get();
            List<MemberShape> blobStreamingMembers = getBlobStreamingMembers(model, input);
            if (blobStreamingMembers.isEmpty()) {
                writer.write("export type $L = $T;", typeName, symbolProvider.toSymbol(input));
            } else {
                writeStreamingMemberType(writer, symbolProvider.toSymbol(input), typeName, blobStreamingMembers.get(0));
            }
        } else {
            // If the input is non-existent, then use an empty object.
            writer.write("export type $L = {}", typeName);
        }
    }

    private void writeOutputType(String typeName, Optional<StructureShape> outputShape) {
        // Output types should always be MetadataBearers, possibly in addition
        // to a defined output shape.
        writer.addImport("MetadataBearer", "__MetadataBearer", TypeScriptDependency.AWS_SDK_TYPES.packageName);
        if (outputShape.isPresent()) {
            writer.write("export type $L = $T & __MetadataBearer;",
                    typeName, symbolProvider.toSymbol(outputShape.get()));
        } else {
            writer.write("export type $L = __MetadataBearer", typeName);
        }
    }

    private void writeErrorType() {
        Symbol operationSymbol = symbolProvider.toSymbol(operation);

        if (operation.getErrors().isEmpty()) {
            writer.write("export type $L = never;", errorsType.getName());
        } else {
            writer.writeInline("export type $LErrors = ", operationSymbol.getName());
            for (Iterator<ShapeId> iter = operation.getErrors().iterator(); iter.hasNext();) {
                writer.writeInline("$T", symbolProvider.toSymbol(model.expectShape(iter.next())));
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
        writer.addImport("Operation", "__Operation", "@aws-smithy/server-common");
        writer.write("export type $L = __Operation<$T, $T>", operationSymbol.getName(), inputType, outputType);
        writer.write("");
    }

    private void writeOperationSerializer() {
        Symbol operationSymbol = symbolProvider.toSymbol(operation);
        String serializerName = operationSymbol.expectProperty("serializerType", Symbol.class).getName();
        Symbol serverSymbol = symbolProvider.toSymbol(model.expectShape(settings.getService()));

        writer.addImport("OperationSerializer", null, "@aws-smithy/server-common");
        writer.openBlock("export class $L implements OperationSerializer<$T, $S, $T> {", "}",
                serializerName, serverSymbol, operation.getId().getName(), errorsType, () -> {
            String serializerFunction = ProtocolGenerator.getGenericSerFunctionName(operationSymbol) + "Response";
            String deserializerFunction = ProtocolGenerator.getGenericDeserFunctionName(operationSymbol) + "Request";
            writer.addImport(serializerFunction, null,
                    "./protocols/" + ProtocolGenerator.getSanitizedName(protocolGenerator.getName()));
            writer.addImport(deserializerFunction, null,
                    "./protocols/" + ProtocolGenerator.getSanitizedName(protocolGenerator.getName()));
            writer.write("serialize = $L;", serializerFunction);
            writer.write("deserialize = $L;", deserializerFunction);
            writer.write("");
            writeErrorChecker();
            writeErrorHandler();
        });
        writer.write("");
    }

    private void writeErrorChecker() {
        writer.openBlock("isOperationError(error: any): error is $T {", "};", errorsType, () -> {
            if (operation.getErrors().isEmpty()) {
                writer.write("return false;");
            } else {
                writer.writeInline("const names: $T['name'][] = [", errorsType);
                for (Iterator<ShapeId> iter = operation.getErrors().iterator(); iter.hasNext();) {
                    writer.writeInline("$S", iter.next().getName());
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
        writer.addImport("SerdeContext", null, "@aws-sdk/types");
        writer.openBlock("serializeError(error: $T, ctx: Omit<SerdeContext, 'endpoint'>): Promise<$T> {", "}",
                errorsType, applicationProtocol.getResponseType(), () -> {
            writer.openBlock("switch (error.name) {", "}", () -> {
                for (ShapeId errorId : operation.getErrors()) {
                    writeErrorHandlerCase(errorId);
                }
                writer.openBlock("default: {", "}", () -> writer.write("throw error;"));
            });
        });
        writer.write("");
    }

    private void writeErrorHandlerCase(ShapeId errorId) {
        Symbol errorSymbol = symbolProvider.toSymbol(model.expectShape(errorId));
        String serializerFunction = ProtocolGenerator.getGenericSerFunctionName(errorSymbol) + "Error";
        writer.addImport(serializerFunction, null,
                "./protocols/" + ProtocolGenerator.getSanitizedName(protocolGenerator.getName()));
        writer.openBlock("case $S: {", "}", errorId.getName(), () -> {
            writer.write("return $L(error, ctx);", serializerFunction);
        });
    }
}
