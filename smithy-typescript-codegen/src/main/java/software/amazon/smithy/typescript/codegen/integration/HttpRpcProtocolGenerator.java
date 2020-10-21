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
import software.amazon.smithy.model.traits.EndpointTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.OptionalUtils;

/**
 * Abstract implementation useful for all HTTP protocols without bindings.
 */
public abstract class HttpRpcProtocolGenerator implements ProtocolGenerator {

    private final Set<Shape> serializingDocumentShapes = new TreeSet<>();
    private final Set<Shape> deserializingDocumentShapes = new TreeSet<>();
    private final Set<StructureShape> deserializingErrorShapes = new TreeSet<>();
    private final boolean isErrorCodeInBody;

    /**
     * Creates a Http RPC protocol generator.
     *
     * @param isErrorCodeInBody A boolean that indicates if the error code for the implementing protocol is located in
     *   the error response body, meaning this generator will parse the body before attempting to load an error code.
     */
    public HttpRpcProtocolGenerator(boolean isErrorCodeInBody) {
        this.isErrorCodeInBody = isErrorCodeInBody;
    }

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
     * {@code serializeInputDocument}. The {@link DocumentShapeSerVisitor} and
     * {@link DocumentMemberSerVisitor} are provided to reduce the effort of this implementation.
     *
     * @param context The generation context.
     * @param shapes The shapes to generate serialization for.
     */
    protected abstract void generateDocumentBodyShapeSerializers(GenerationContext context, Set<Shape> shapes);

    /**
     * Generates deserialization functions for shapes in the passed set. These functions
     * should return a value that can then be deserialized by the implementation of
     * {@code deserializeOutputDocument}. The {@link DocumentShapeDeserVisitor} and
     * {@link DocumentMemberDeserVisitor} are provided to reduce the effort of this implementation.
     *
     * @param context The generation context.
     * @param shapes The shapes to generate deserialization for.
     */
    protected abstract void generateDocumentBodyShapeDeserializers(GenerationContext context, Set<Shape> shapes);

    @Override
    public void generateSharedComponents(GenerationContext context) {
        deserializingErrorShapes.forEach(error -> generateErrorDeserializer(context, error));
        generateDocumentBodyShapeSerializers(context, serializingDocumentShapes);
        generateDocumentBodyShapeDeserializers(context, deserializingDocumentShapes);
        HttpProtocolGeneratorUtils.generateMetadataDeserializer(context, getApplicationProtocol().getResponseType());
        HttpProtocolGeneratorUtils.generateCollectBody(context);
        HttpProtocolGeneratorUtils.generateCollectBodyString(context);

        TypeScriptWriter writer = context.getWriter();

        // Write a function to generate HTTP requests since they're so similar.
        SymbolReference requestType = getApplicationProtocol().getRequestType();
        writer.addUseImports(requestType);
        writer.addImport("SerdeContext", "__SerdeContext", "@aws-sdk/types");
        writer.addImport("HeaderBag", "__HeaderBag", "@aws-sdk/types");
        writer.openBlock("const buildHttpRpcRequest = async (\n"
                       + "  context: __SerdeContext,\n"
                       + "  headers: __HeaderBag,\n"
                       + "  path: string,\n"
                       + "  resolvedHostname: string | undefined,\n"
                       + "  body: any,\n"
                       + "): Promise<$T> => {", "};", requestType, () -> {
            // Get the hostname, port, and scheme from client's resolved endpoint. Then construct the request from
            // them. The client's resolved endpoint can be default one or supplied by users.
            writer.write("const {hostname, protocol = \"https\", port} = await context.endpoint();");
            writer.openBlock("const contents: any = {", "};", () -> {
                writer.write("protocol,");
                writer.write("hostname,");
                writer.write("port,");
                writer.write("method: \"POST\",");
                writer.write("path,");
                writer.write("headers,");
            });
            writer.openBlock("if (resolvedHostname !== undefined) {", "}", () -> {
                writer.write("contents.hostname = resolvedHostname;");
            });
            writer.openBlock("if (body !== undefined) {", "}", () -> {
                writer.write("contents.body = body;");
            });
            writer.write("return new $T(contents);", requestType);
        });
        writer.write("");
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
        writer.addImport("SerdeContext", "__SerdeContext", "@aws-sdk/types");
        writer.addImport("Endpoint", "__Endpoint", "@aws-sdk/types");
        // e.g., serializeAws_restJson1_1ExecuteStatement
        String methodName = ProtocolGenerator.getSerFunctionName(symbol, getName());
        // Add the normalized input type.
        Symbol inputType = symbol.expectProperty("inputType", Symbol.class);

        writer.openBlock("export const $L = async(\n"
                       + "  input: $T,\n"
                       + "  context: __SerdeContext\n"
                       + "): Promise<$T> => {", "}", methodName, inputType, requestType, () -> {
            writeRequestHeaders(context, operation);
            boolean hasRequestBody = writeRequestBody(context, operation);
            boolean hasHostPrefix = operation.hasTrait(EndpointTrait.class);

            if (hasHostPrefix) {
                HttpProtocolGeneratorUtils.writeHostPrefix(context, operation);
            }

            // Construct the request with the operation's path and optional hostname and body.
            writer.write("return buildHttpRpcRequest(context, headers, $S, $L, $L);",
                    getOperationPath(context, operation),
                    hasHostPrefix ? "resolvedHostname" : "undefined",
                    hasRequestBody ? "body" : "undefined");
        });

        writer.write("");
    }

    private void writeRequestHeaders(GenerationContext context, OperationShape operation) {
        TypeScriptWriter writer = context.getWriter();

        // The Content-Type header is always present.
        writer.addImport("HeaderBag", "__HeaderBag", "@aws-sdk/types");
        writer.openBlock("const headers: __HeaderBag = {", "};",
            () -> {
                writer.write("'Content-Type': $S,", getDocumentContentType());
                writeDefaultHeaders(context, operation);
            }
        );
    }

    private boolean writeRequestBody(GenerationContext context, OperationShape operation) {
        if (operation.getInput().isPresent()) {
            // If there's an input present, we know it's a structure.
            StructureShape inputShape = context.getModel().expectShape(operation.getInput().get())
                    .asStructureShape().get();

            // Track input shapes so their serializers may be generated.
            serializingDocumentShapes.add(inputShape);

            // Write the default `body` property.
            context.getWriter().write("let body: any;");
            serializeInputDocument(context, operation, inputShape);
            return true;
        }

        return writeUndefinedInputBody(context, operation);
    }

    /**
     * Provides the request path for the operation.
     *
     * @param context The generation context.
     * @param operation The operation being generated.
     * @return The path to send HTTP requests to.
     */
    protected abstract String getOperationPath(GenerationContext context, OperationShape operation);

    /**
     * Writes any additional HTTP headers required by the protocol implementation.
     *
     * <p>Two parameters will be available in scope:
     * <ul>
     *   <li>{@code input: <T>}: the type generated for the operation's input.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>For example:
     *
     * <pre>{@code
     *   "foo": "This is a custom header",
     * }</pre>
     *
     * @param context The generation context.
     * @param operation The operation being generated.
     */
    protected void writeDefaultHeaders(GenerationContext context, OperationShape operation) {}

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
     * const wrappedBody: any = {
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

    /**
     * Writes any default body contents when an operation has an undefined input.
     *
     * <p>Implementations of this method are expected to set a value to the
     * {@code body} variable that will be serialized as the request body.
     * This variable will NOT be defined in scope and should be defined by
     * implementations if they wish to set it.
     *
     * <p>For example:
     *
     * <pre>{@code
     * const body = "{}";
     * }</pre>
     *
     * <p>Implementations should return true if they define a body variable, and
     * false otherwise.
     *
     * @param context The generation context.
     * @param operation The operation being generated.
     * @return If a body variable was defined.
     */
    protected boolean writeUndefinedInputBody(GenerationContext context, OperationShape operation) {
        // Pass
        return false;
    }

    private void generateOperationDeserializer(GenerationContext context, OperationShape operation) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference responseType = getApplicationProtocol().getResponseType();
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the response type is imported.
        writer.addUseImports(responseType);
        writer.addImport("SerdeContext", "__SerdeContext", "@aws-sdk/types");
        // e.g., deserializeAws_restJson1_1ExecuteStatement
        String methodName = ProtocolGenerator.getDeserFunctionName(symbol, getName());
        String errorMethodName = methodName + "Error";
        // Add the normalized output type.
        Symbol outputType = symbol.expectProperty("outputType", Symbol.class);

        // Handle the general response.
        writer.openBlock("export const $L = async(\n"
                       + "  output: $T,\n"
                       + "  context: __SerdeContext\n"
                       + "): Promise<$T> => {", "}", methodName, responseType, outputType, () -> {
            // Redirect error deserialization to the dispatcher
            writer.openBlock("if (output.statusCode >= 300) {", "}", () -> {
                writer.write("return $L(output, context);", errorMethodName);
            });

            // Start deserializing the response.
            readResponseBody(context, operation);

            // Build the response with typing and metadata.
            writer.openBlock("const response: $T = {", "};", outputType, () -> {
                writer.write("$$metadata: deserializeMetadata(output),");
                operation.getOutput().ifPresent(outputId -> {
                    writer.write("...contents,");
                });
            });
            writer.write("return Promise.resolve(response);");
        });
        writer.write("");

        // Write out the error deserialization dispatcher.
        Set<StructureShape> errorShapes = HttpProtocolGeneratorUtils.generateErrorDispatcher(
                context, operation, responseType, this::writeErrorCodeParser,
                isErrorCodeInBody, this::getErrorBodyLocation);
        deserializingErrorShapes.addAll(errorShapes);
    }

    private void generateErrorDeserializer(GenerationContext context, StructureShape error) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol errorSymbol = symbolProvider.toSymbol(error);
        String errorDeserMethodName = ProtocolGenerator.getDeserFunctionName(errorSymbol,
                context.getProtocolName()) + "Response";

        // Add the error shape to the list to generate functions for, since we'll use that.
        deserializingDocumentShapes.add(error);
        String outputReference = isErrorCodeInBody ? "parsedOutput" : "output";
        writer.openBlock("const $L = async (\n"
                       + "  $L: any,\n"
                       + "  context: __SerdeContext\n"
                       + "): Promise<$T> => {", "};", errorDeserMethodName, outputReference, errorSymbol, () -> {
            // First deserialize the body properly.
            if (isErrorCodeInBody) {
                // Body is already parsed in the error dispatcher, simply assign the body.
                writer.write("const body = $L.body", outputReference);
            } else {
                // The dispatcher defers parsing the body in cases where protocols do not have
                // their error code in the body, so we handle that parsing before deserializing
                // the error shape here.
                writer.write("const body = parseBody($L.body, context);", outputReference);
            }
            writer.write("const deserialized: any = $L($L, context);",
                    ProtocolGenerator.getDeserFunctionName(errorSymbol, context.getProtocolName()),
                    getErrorBodyLocation(context, "body"));

            // Then load it into the object with additional error and response properties.
            writer.openBlock("const contents: $T = {", "};", errorSymbol, () -> {
                writer.write("name: $S,", error.getId().getName());
                writer.write("$$fault: $S,", error.getTrait(ErrorTrait.class).get().getValue());
                HttpProtocolGeneratorUtils.writeRetryableTrait(writer, error, ",");
                writer.write("$$metadata: deserializeMetadata($L),", outputReference);
                writer.write("...deserialized,");
            });

            writer.write("return contents;");
        });

        writer.write("");
    }

    private void readResponseBody(GenerationContext context, OperationShape operation) {
        TypeScriptWriter writer = context.getWriter();
        OptionalUtils.ifPresentOrElse(
                operation.getOutput(),
                outputId -> {
                    // We only need to load the body and prepare a contents object if there is a response.
                    writer.write("const data: any = await parseBody(output.body, context)");
                    writer.write("let contents: any = {};");

                    // If there's an output present, we know it's a structure.
                    StructureShape outputShape = context.getModel().expectShape(outputId).asStructureShape().get();

                    // Track output shapes so their deserializers may be generated.
                    deserializingDocumentShapes.add(outputShape);

                    deserializeOutputDocument(context, operation, outputShape);
                },
                () -> {
                    // If there is no output, the body still needs to be collected so the process can exit.
                    writer.write("await collectBody(output.body, context);");
                });
    }

    /**
     * Writes the code that loads an {@code errorCode} String with the content used
     * to dispatch errors to specific serializers.
     *
     * <p>Two variables will be in scope:
     *   <ul>
     *       <li>{@code output} or {@code parsedOutput}: a value of the HttpResponse type.
     *          <ul>
     *              <li>{@code output} is a raw HttpResponse, available when {@code isErrorCodeInBody} is set to
     *              {@code false}</li>
     *              <li>{@code parsedOutput} is a HttpResponse type with body parsed to JavaScript object, available
     *              when {@code isErrorCodeInBody} is set to {@code true}</li>
     *          </ul>
     *       </li>
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
     * Provides where within the passed output variable the actual error resides. This is useful
     * for protocols that wrap the specific error in additional elements within the body.
     *
     * @param context The generation context.
     * @param outputLocation The name of the variable containing the output body.
     * @return A string of the variable containing the error body within the output body.
     */
    protected String getErrorBodyLocation(GenerationContext context, String outputLocation) {
        return outputLocation;
    }

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
