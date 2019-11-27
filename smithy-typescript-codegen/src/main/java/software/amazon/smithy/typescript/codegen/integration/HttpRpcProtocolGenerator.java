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

package software.amazon.smithy.typescript.codegen.integration;

import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.StringUtils;

/**
 * Abstract implementation useful for all HTTP protocols without bindings.
 */
public abstract class HttpRpcProtocolGenerator implements ProtocolGenerator {

    private final Set<Shape> documentSerializingShapes = new TreeSet<>();
    private final Set<Shape> documentDeserializingShapes = new TreeSet<>();

    @Override
    public ApplicationProtocol getApplicationProtocol() {
        return ApplicationProtocol.createDefaultHttpApplicationProtocol();
    }

    /**
     * Gets the content-type for a request body.
     *
     * @return Returns the default content-type.
     */
    protected abstract String getDocumentContentType();

    /**
     * Generates serialization functions for shapes in the passed set. These functions
     * should return a value that can then be serialized by the implementation of
     * {@code serializeDocument}. The {@link DocumentShapeSerVisitor} and {@link DocumentMemberSerVisitor}
     * are provided to reduce the effort of this implementation.
     *
     * TODO.
     *
     * @param context The generation context.
     * @param shapes The shapes to generate serialization for.
     */
    protected abstract void generateDocumentShapeSerializers(GenerationContext context, Set<Shape> shapes);

    /**
     * Generates deserialization functions for shapes in the passed set. These functions
     * should return a value that can then be deserialized by the implementation of
     * {@code deserializeDocument}. The {@link DocumentShapeDeserVisitor} and
     * {@link DocumentMemberDeserVisitor} are provided to reduce the effort of this implementation.
     *
     * TODO.
     *
     * @param context The generation context.
     * @param shapes The shapes to generate deserialization for.
     */
    protected abstract void generateDocumentShapeDeserializers(GenerationContext context, Set<Shape> shapes);

    @Override
    public void generateSharedComponents(GenerationContext context) {
        generateDocumentShapeSerializers(context, documentSerializingShapes);
        generateDocumentShapeDeserializers(context, documentDeserializingShapes);
        HttpProtocolGeneratorUtils.generateMetadataDeserializer(context, getApplicationProtocol().getResponseType());
    }

    @Override
    public void generateRequestSerializers(GenerationContext context) {
        TopDownIndex topDownIndex = context.getModel().getKnowledge(TopDownIndex.class);

        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));
        for (OperationShape operation : containedOperations) {
            generateOperationSerializer(context, operation);
        }
    }

    @Override
    public void generateResponseDeserializers(GenerationContext context) {
        TopDownIndex topDownIndex = context.getModel().getKnowledge(TopDownIndex.class);

        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));
        for (OperationShape operation : containedOperations) {
            generateOperationDeserializer(context, operation);
        }
    }

    private void generateOperationSerializer(GenerationContext context, OperationShape operation) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference requestType = getApplicationProtocol().getRequestType();
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the request type is imported.
        writer.addUseImports(requestType);
        writer.addImport("SerdeContext", "SerdeContext", "@aws-sdk/types");
        writer.addImport("Endpoint", "__Endpoint", "@aws-sdk/types");
        // e.g., serializeAws_restJson1_1ExecuteStatement
        String methodName = ProtocolGenerator.getSerFunctionName(symbol, getName());
        // TODO Do we need to handle optional input everywhere?
        // Add the normalized input type.
        Symbol inputType = symbol.expectProperty("inputType", Symbol.class);

        writer.openBlock("export async function $L(\n"
                                 + "  input: $T,\n"
                                 + "  context: SerdeContext\n"
                                 + "): Promise<$T> {", "}", methodName, inputType, requestType, () -> {
            writeRequestHeaders(context);
            boolean hasRequestBody = writeRequestBody(context, operation);

            writer.openBlock("return new $T({", "});", requestType, () -> {
                writer.write("...context.endpoint,");
                writer.write("protocol: \"https\",");
                writer.write("method: \"POST\",");
                writer.write("path: \"/$L\",", StringUtils.capitalize(operation.getId().getName()));
                writer.write("headers: headers,");
                if (hasRequestBody) {
                    writer.write("body: body,");
                }
            });
        });

        writer.write("");
    }

    private void writeRequestHeaders(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();

        // The Content-Type header is always present.
        writer.write("let headers: any = {};");
        writer.write("headers['Content-Type'] = $S;", getDocumentContentType());
    }

    private boolean writeRequestBody(GenerationContext context, OperationShape operation) {
        if (operation.getInput().isPresent()) {
            // If there's an input present, we know it's a structure.
            StructureShape inputShape = context.getModel().getShapeIndex().getShape(operation.getInput().get())
                    .get().asStructureShape().get();

            // Track input shapes so their serializers may be generated.
            documentSerializingShapes.add(inputShape);

            // Write the default `body` property.
            context.getWriter().write("let body: any = undefined;");
            serializeInputDocument(context, operation, inputShape);
            return true;
        }

        return false;
    }

    /**
     * Writes the code needed to serialize the input document of a request.
     *
     * <p>Implementations of this method are expected to set a value to the
     * {@code body} variable that will be serialized as the request body.
     * This variable will already be defined in scope.
     *
     * <p>For example:
     *
     * <pre>{@code
     * let wrappedBody: any = {
     *   OperationRequest: serializeAws_json1_1OperationRequest(input, context),
     * };
     * body = JSON.stringify(wrappedBody);
     * }</pre>
     *
     * @param context The generation context.
     * @param operation The operation being generated.
     * @param inputStructure The structure containing the operation input.
     */
    protected abstract void serializeInputDocument(
            GenerationContext context,
            OperationShape operation,
            StructureShape inputStructure
    );

    private void generateOperationDeserializer(GenerationContext context, OperationShape operation) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference responseType = getApplicationProtocol().getResponseType();
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the response type is imported.
        writer.addUseImports(responseType);
        writer.addImport("SerdeContext", "SerdeContext", "@aws-sdk/types");
        // e.g., deserializeAws_restJson1_1ExecuteStatement
        String methodName = ProtocolGenerator.getDeserFunctionName(symbol, getName());
        String errorMethodName = methodName + "Error";
        // TODO Do we need to handle optional outputs everywhere?
        // Add the normalized output type.
        Symbol outputType = symbol.expectProperty("outputType", Symbol.class);

        // Handle the general response.
        writer.openBlock("export async function $L(\n"
                       + "  output: $T,\n"
                       + "  context: SerdeContext\n"
                       + "): Promise<$T> {", "}", methodName, responseType, outputType, () -> {
            // Redirect error deserialization to the dispatcher
            writer.openBlock("if (output.statusCode >= 400) {", "}", () -> {
                writer.write("return $L(output, context);", errorMethodName);
            });

            // Start deserializing the response.
            writer.write("let data: any = await parseBody(output.body, context)");
            writer.write("let contents: any = {};");
            readResponseBody(context, operation);

            // Build the response with typing and metadata.
            writer.openBlock("let response: $T = {", "};", outputType, () -> {
                writer.write("$$metadata: deserializeMetadata(output),");
                operation.getOutput().ifPresent(outputId -> {
                    writer.write("__type: $S,", outputId.getName());
                    writer.write("...contents,");
                });
            });
            writer.write("return Promise.resolve(response);");
        });
        writer.write("");

        // Write out the error deserialization dispatcher.
        documentDeserializingShapes.addAll(HttpProtocolGeneratorUtils.generateErrorDispatcher(
                context, operation, responseType, this::writeErrorCodeParser));
    }

    private void readResponseBody(GenerationContext context, OperationShape operation) {
        operation.getOutput().ifPresent(outputId -> {
            // If there's an output present, we know it's a structure.
            StructureShape outputShape = context.getModel().getShapeIndex().getShape(outputId)
                    .get().asStructureShape().get();

            // Track output shapes so their deserializers may be generated.
            documentDeserializingShapes.add(outputShape);

            deserializeOutputDocument(context, operation, outputShape);
        });
    }

    /**
     * Writes the code that loads an {@code errorCode} String with the content used
     * to dispatch errors to specific serializers.
     *
     * <p>Three variables will be in scope:
     *   <ul>
     *       <li>{@code output}: a value of the HttpResponse type.</li>
     *       <li>{@code data}: the contents of the response body.</li>
     *       <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example:
     *
     * <pre>{@code
     * errorCode = output.headers["x-amzn-errortype"].split(':')[0];
     * }</pre>
     *
     * @param context The generation context.
     */
    protected abstract void writeErrorCodeParser(GenerationContext context);

    /**
     * Writes the code needed to deserialize the output document of a response.
     *
     * <p>Implementations of this method are expected to set members in the
     * {@code contents} variable that represents the type generated for the
     * response. This variable will already be defined in scope.
     *
     * <p>The contents of the response body will be available in a {@code data} variable.
     *
     * <p>For example:
     *
     * <pre>{@code
     * contents = deserializeAws_json1_1OperationResponse(data.OperationResponse, context);
     * }</pre>
     *
     * @param context The generation context.
     * @param operation The operation being generated.
     * @param outputStructure The structure containing the operation output.
     */
    protected abstract void deserializeOutputDocument(
            GenerationContext context,
            OperationShape operation,
            StructureShape outputStructure
    );
}
