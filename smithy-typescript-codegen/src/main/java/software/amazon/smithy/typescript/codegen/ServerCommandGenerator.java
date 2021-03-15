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

import java.util.List;
import java.util.Optional;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.StructureShape;

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

    ServerCommandGenerator(
            TypeScriptSettings settings,
            Model model,
            OperationShape operation,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer
    ) {
        this.settings = settings;
        this.model = model;
        this.operation = operation;
        this.symbolProvider = symbolProvider;
        this.writer = writer;

        Symbol operationSymbol = symbolProvider.toSymbol(operation);
        operationIndex = OperationIndex.of(model);
        inputType = operationSymbol.expectProperty("inputType", Symbol.class);
        outputType = operationSymbol.expectProperty("outputType", Symbol.class);
    }

    @Override
    public void run() {
        addInputAndOutputTypes();
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
}
