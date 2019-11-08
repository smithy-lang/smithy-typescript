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

import static software.amazon.smithy.model.knowledge.HttpBinding.Location;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.BiConsumer;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.knowledge.HttpBindingIndex;
import software.amazon.smithy.model.knowledge.NeighborProviderIndex;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.neighbor.Walker;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.BooleanShape;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.NumberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.SetShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.ShapeIndex;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.HttpTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.OptionalUtils;

/**
 * Abstract implementation useful for all protocols that use HTTP bindings.
 */
public abstract class HttpBindingProtocolGenerator implements ProtocolGenerator {

    private static final Logger LOGGER = Logger.getLogger(HttpBindingProtocolGenerator.class.getName());

    @Override
    public ApplicationProtocol getApplicationProtocol() {
        return ApplicationProtocol.createDefaultHttpApplicationProtocol();
    }

    /**
     * Gets the default serde format for timestamps.
     *
     * @return Returns the default format.
     */
    protected abstract Format getDocumentTimestampFormat();

    /**
     * Gets the default content-type when a document is synthesized in the body.
     *
     * @return Returns the default content-type.
     */
    protected abstract String getDocumentContentType();

    @Override
    public void generateSharedComponents(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();

        SymbolReference responseType = getApplicationProtocol().getResponseType();
        writer.addImport("ResponseMetadata", "__ResponseMetadata", "@aws-sdk/types");
        writer.openBlock("const deserializeMetadata = (output: $T): __ResponseMetadata => ({", "});", responseType,
                () -> {
                    writer.write("httpStatusCode: output.statusCode,");
                    writer.write("httpHeaders: output.headers,");
                    writer.write("requestId: output.headers[\"x-amzn-requestid\"]");
                });
        writer.write("");
    }

    @Override
    public void generateRequestSerializers(GenerationContext context) {
        TopDownIndex topDownIndex = context.getModel().getKnowledge(TopDownIndex.class);
        OperationIndex operationIndex = context.getModel().getKnowledge(OperationIndex.class);
        Walker shapeWalker = new Walker(context.getModel().getKnowledge(NeighborProviderIndex.class).getProvider());

        // Track the shapes we need to generate sub-serializers for.
        Set<Shape> serializingShapes = new TreeSet<>();
        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));
        for (OperationShape operation : containedOperations) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationSerializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol request bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));

            operationIndex.getInput(operation)
                    .ifPresent(input -> serializingShapes.addAll(shapeWalker.walkShapes(input).stream()
                            // Don't generate a sub-serializer for the actual input shape.
                            // One is generated for it separately in generateOperationSerializer.
                            .filter(s -> !input.equals(s))
                            .collect(Collectors.toSet())));
        }

        // Generate the serializers for shapes within the operation closure.
        serializingShapes.forEach(shape -> shape.accept(new ShapeSerializingVisitor(context, true)));
    }

    @Override
    public void generateResponseDeserializers(GenerationContext context) {
        TopDownIndex topDownIndex = context.getModel().getKnowledge(TopDownIndex.class);
        OperationIndex operationIndex = context.getModel().getKnowledge(OperationIndex.class);
        Walker shapeWalker = new Walker(context.getModel().getKnowledge(NeighborProviderIndex.class).getProvider());

        // Track the shapes we need to generate sub-serializers for.
        Set<Shape> deserializingShapes = new TreeSet<>();
        Set<StructureShape> deserializingErrors = new TreeSet<>();
        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));
        for (OperationShape operation : containedOperations) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationDeserializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol response bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));

            operationIndex.getOutput(operation)
                    .ifPresent(output -> shapeWalker.walkShapes(output).stream()
                            // Don't generate a sub-serializer for the actual output shape.
                            // One is generated for it separately in generateOperationDeserializer.
                            .filter(s -> !output.equals(s))
                            .forEach(deserializingShapes::add));
            operationIndex.getErrors(operation)
                    .forEach(error -> {
                        // Error shapes will have their own specific serializers generated.
                        // Add them to their own list and avoid including them in the main list.
                        deserializingErrors.add(error);
                        shapeWalker.walkShapes(error).stream()
                                .filter(s -> !error.equals(s))
                                .forEach(deserializingShapes::add);
                    });
        }

        // Generate the serializers for error shapes.
        deserializingErrors.forEach(shape -> readErrorBody(context, shape));

        // Generate the serializers for shapes within the operation closure.
        deserializingShapes.forEach(shape -> shape.accept(new ShapeSerializingVisitor(context, false)));
    }

    private void generateOperationSerializer(
            GenerationContext context,
            OperationShape operation,
            HttpTrait trait
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference requestType = getApplicationProtocol().getRequestType();
        HttpBindingIndex bindingIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the request type is imported.
        writer.addUseImports(requestType);
        writer.addImport("SerdeContext", "SerdeContext", "@aws-sdk/types");
        writer.addImport("Endpoint", "__Endpoint", "@aws-sdk/types");
        // e.g., serializeAws_restJson1_1ExecuteStatement
        String methodName = ProtocolGenerator.getSerFunctionName(symbol, getName());
        // Add the normalized input type.
        String inputType = symbol.getName() + "Input";
        writer.addImport(inputType, inputType, symbol.getNamespace());

        writer.openBlock("export function $L(\n"
                       + "  input: $L,\n"
                       + "  context: SerdeContext\n"
                       + "): $T {", "}", methodName, inputType, requestType, () -> {
            List<HttpBinding> labelBindings = writeRequestLabels(context, operation, bindingIndex, trait);
            List<HttpBinding> queryBindings = writeRequestQueryString(context, operation, bindingIndex);
            writeHeaders(context, operation, bindingIndex);
            List<HttpBinding> documentBindings = writeRequestBody(context, operation, bindingIndex);

            writer.openBlock("return new $T({", "});", requestType, () -> {
                writer.write("...context.endpoint,");
                writer.write("protocol: \"https\",");
                writer.write("method: $S,", trait.getMethod());
                if (labelBindings.isEmpty()) {
                    writer.write("path: $S,", trait.getUri());
                } else {
                    writer.write("path: resolvedPath,");
                }
                writer.write("headers: headers,");
                if (!documentBindings.isEmpty()) {
                    writer.write("body: body,");
                }
                if (!queryBindings.isEmpty()) {
                    writer.write("query: query,");
                }
            });
        });

        writer.write("");
    }

    private List<HttpBinding> writeRequestLabels(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex,
            HttpTrait trait
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        List<HttpBinding> labelBindings = bindingIndex.getRequestBindings(operation, Location.LABEL);

        if (!labelBindings.isEmpty()) {
            ShapeIndex index = context.getModel().getShapeIndex();
            writer.write("let resolvedPath = $S;", trait.getUri());
            for (HttpBinding binding : labelBindings) {
                String memberName = symbolProvider.toMemberName(binding.getMember());
                writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
                    Shape target = index.getShape(binding.getMember().getTarget()).get();
                    String labelValue = getInputValue(context, binding.getLocation(), "input." + memberName,
                            binding.getMember(), target);
                    writer.write("resolvedPath = resolvedPath.replace('{$1S}', $L);", labelValue);
                });
            }
        }

        return labelBindings;
    }

    private List<HttpBinding> writeRequestQueryString(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        List<HttpBinding> queryBindings = bindingIndex.getRequestBindings(operation, Location.QUERY);

        if (!queryBindings.isEmpty()) {
            ShapeIndex index = context.getModel().getShapeIndex();
            writer.write("let query = {};");
            for (HttpBinding binding : queryBindings) {
                String memberName = symbolProvider.toMemberName(binding.getMember());
                writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
                    Shape target = index.getShape(binding.getMember().getTarget()).get();
                    String queryValue = getInputValue(context, binding.getLocation(), "input." + memberName,
                            binding.getMember(), target);
                    writer.write("query['$L'] = $L;", binding.getLocationName(), queryValue);
                });
            }
        }

        return queryBindings;
    }

    private void writeHeaders(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        // Headers are always present either from the default document or the payload.
        writer.write("let headers: any = {};");
        writer.write("headers['Content-Type'] = $S;", bindingIndex.determineRequestContentType(
                operation, getDocumentContentType()));

        operation.getInput().ifPresent(outputId -> {
            ShapeIndex index = context.getModel().getShapeIndex();
            for (HttpBinding binding : bindingIndex.getRequestBindings(operation, Location.HEADER)) {
                String memberName = symbolProvider.toMemberName(binding.getMember());
                writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
                    Shape target = index.getShape(binding.getMember().getTarget()).get();
                    String headerValue = getInputValue(context, binding.getLocation(), "input." + memberName,
                            binding.getMember(), target);
                    writer.write("headers['$L'] = $L;", binding.getLocationName(), headerValue);
                });
            }

            // Handle assembling prefix headers.
            for (HttpBinding binding : bindingIndex.getRequestBindings(operation, Location.PREFIX_HEADERS)) {
                String memberName = symbolProvider.toMemberName(binding.getMember());
                writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
                    Shape target = index.getShape(binding.getMember().getTarget()).get();
                    // Iterate through each entry in the member.
                    writer.openBlock("Object.keys(input.$L).forEach(suffix -> {", "});", memberName, () -> {
                        String headerValue = getInputValue(context, binding.getLocation(),
                                "input." + memberName + "[suffix]", binding.getMember(), target);
                        // Append the suffix to the defined prefix and serialize the value in to that key.
                        writer.write("headers['$L' + suffix] = $L;", binding.getLocationName(), headerValue);
                    });
                });
            }
        });
    }

    private List<HttpBinding> writeRequestBody(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        List<HttpBinding> documentBindings = bindingIndex.getRequestBindings(operation, Location.DOCUMENT);
        documentBindings.sort(Comparator.comparing(HttpBinding::getMemberName));
        List<HttpBinding> payloadBindings = bindingIndex.getRequestBindings(operation, Location.PAYLOAD);

        if (!documentBindings.isEmpty()) {
            // Write the default `body` property.
            context.getWriter().write("let body: any = undefined;");
            serializeDocument(context, operation, documentBindings);
            return documentBindings;
        }
        if (!payloadBindings.isEmpty()) {
            SymbolProvider symbolProvider = context.getSymbolProvider();
            // There can only be one payload binding.
            HttpBinding binding = payloadBindings.get(0);
            String memberName = symbolProvider.toMemberName(binding.getMember());
            Shape target = context.getModel().getShapeIndex().getShape(binding.getMember().getTarget()).get();
            writer.write("let body: any = $L;", getInputValue(
                    context, Location.PAYLOAD, "input." + memberName, binding.getMember(), target));
            return payloadBindings;
        }

        return ListUtils.of();
    }

    /**
     * Given context and a source of data, generate an input value provider for the
     * shape. This may use native types (like getting Date formats for timestamps,)
     * converters (like a base64Encoder,) or invoke complex type serializers to
     * manipulate the dataSource into the proper input content.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation input.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param member The member that points to the value being provided.
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the input value.
     */
    protected String getInputValue(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            MemberShape member,
            Shape target
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();

        if (isNativeSimpleType(target)) {
            return dataSource;
        } else if (target instanceof TimestampShape) {
            HttpBindingIndex httpIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
            Format format = httpIndex.determineTimestampFormat(member, bindingType, getDocumentTimestampFormat());
            return getTimestampInputParam(dataSource, member, format);
        } else if (target instanceof BlobShape) {
            return getBlobInputParam(dataSource, bindingType);
        } else if (target instanceof CollectionShape) {
            return getCollectionInputParam(context, bindingType, dataSource, target);
        } else if (target instanceof StructureShape || target instanceof UnionShape || target instanceof MapShape) {
            Symbol symbol = symbolProvider.toSymbol(target);
            return ProtocolGenerator.getSerFunctionName(symbol, getName()) + "(" + dataSource + ", context)";
        }

        throw new CodegenException(String.format(
                "Unsupported %s binding of %s to %s in %s using the %s protocol",
                bindingType, member.getMemberName(), target.getType(), member.getContainer(), getName()));
    }

    private String getTimestampInputParam(String dataSource, MemberShape member, Format format) {
        switch (format) {
            case DATE_TIME:
                return dataSource + ".toISOString()";
            case EPOCH_SECONDS:
                return "Math.round(" + dataSource + ".getTime() / 1000)";
            case HTTP_DATE:
                return dataSource + ".toUTCString()";
            default:
                throw new CodegenException("Unexpected timestamp format `" + format.toString() + "` on " + member);
        }
    }

    private String getBlobInputParam(String dataSource, Location bindingType) {
        switch (bindingType) {
            case PAYLOAD:
                return dataSource;
            case HEADER:
            case DOCUMENT:
            case QUERY:
                // Encode these to base64.
                return "context.base64Encoder.toBase64(" + dataSource + ")";
            default:
                throw new CodegenException("Unexpected blob binding location `" + bindingType + "`");
        }
    }

    private String getCollectionInputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            Shape target
    ) {
        switch (bindingType) {
            case HEADER:
                // Join these values with commas.
                return "(" + dataSource + " || []).toString()";
            case DOCUMENT:
                SymbolProvider symbolProvider = context.getSymbolProvider();
                Symbol symbol = symbolProvider.toSymbol(target);

                return ProtocolGenerator.getSerFunctionName(symbol, getName()) + "(" + dataSource + ", context)";
            case QUERY:
                return dataSource;
            default:
                throw new CodegenException("Unexpected collection binding location `" + bindingType + "`");
        }
    }

    /**
     * Writes the code needed to serialize the input document of a request.
     *
     * Implementations of this method are expected to set a value to the
     * {@code body} variable that will be serialized as the request body.
     * This variable will already be defined in scope.
     *
     * <p>For example:
     *
     * <pre>{@code
     * let bodyParams: any = {};
     * if (input.barValue !== undefined) {
     *   bodyParams['barValue'] = input.barValue;
     * }
     * body = JSON.stringify(bodyParams);
     * }</pre>
     *
     * @param context The generation context.
     * @param operation The operation being generated.
     * @param documentBindings The bindings to place in the document.
     */
    protected abstract void serializeDocument(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    );

    /**
     * Writes the code needed to serialize a structure in the document of a request.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns a value representing the StructureShape {@code shape} parameter that is
     * serializable by {@code serializeDocument}.
     *
     * <p>The function signature for this body will have two parameters:
     *   <ul>
     *     <li>{@code input}: the type generated for the StructureShape shape parameter.</li>
     *     <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example, this function would generate the following:
     *
     * <pre>{@code
     *   let bodyParams: any = {}
     *   if (input.fooValue !== undefined) {
     *     bodyParams['fooValue'] = serializeAws_restJson1_1Foo(input.fooValue, context);
     *   }
     *   if (input.barValue !== undefined) {
     *     bodyParams['barValue'] = input.barValue;
     *   }
     *   return bodyParams;
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The structure shape being generated.
     */
    protected abstract void serializeDocumentStructure(GenerationContext context, StructureShape shape);

    /**
     * Writes the code needed to serialize a union in the document of a request.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns a value representing the UnionShape {@code shape} parameter that is
     * serializable by {@code serializeDocument}.
     *
     * <p>The function signature for this body will have two parameters:
     *   <ul>
     *     <li>{@code input}: the type generated for the UnionShape shape parameter.</li>
     *     <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example, this function would generate the following:
     * <pre>{@code
     *   return Field.visit(input, {
     *     fooValue: value => serializeAws_restJson1_1Foo(value, context),
     *     barValue: value => value,
     *     _: value => value
     *   });
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The union shape being generated.
     */
    protected abstract void serializeDocumentUnion(GenerationContext context, UnionShape shape);

    /**
     * Writes the code needed to serialize a collection in the document of a request.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns a value representing the CollectionShape {@code shape} parameter that is
     * serializable by {@code serializeDocument}.
     *
     * <p>The function signature for this body will have two parameters:
     *   <ul>
     *     <li>{@code input}: the type generated for the CollectionShape shape parameter.</li>
     *     <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example, this function would generate the following:
     *
     * <pre>{@code
     *   return (input || []).map(entry =>
     *     serializeAws_restJson1_1Parameter(entry, context)
     *   );
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The collection shape being generated.
     */
    protected abstract void serializeDocumentCollection(GenerationContext context, CollectionShape shape);

    /**
     * Writes the code needed to serialize a map in the document of a request.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns a value representing the MapShape {@code shape} parameter that is
     * serializable by {@code serializeDocument}.
     *
     * <p>The function signature for this body will have two parameters:
     *   <ul>
     *     <li>{@code input}: the type generated for the MapShape shape parameter.</li>
     *     <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example, this function would generate the following:
     *
     * <pre>{@code
     *   let mapParams: any = {};
     *   Object.keys(input).forEach(key => {
     *     mapParams[key] = serializeAws_restJson1_1Field(input[key], context);
     *   });
     *   return mapParams;
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The map shape being generated.
     */
    protected abstract void serializeDocumentMap(GenerationContext context, MapShape shape);

    private void generateOperationDeserializer(
            GenerationContext context,
            OperationShape operation,
            HttpTrait trait
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference responseType = getApplicationProtocol().getResponseType();
        HttpBindingIndex bindingIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the response type is imported.
        writer.addUseImports(responseType);
        writer.addImport("SerdeContext", "SerdeContext", "@aws-sdk/types");
        // e.g., deserializeAws_restJson1_1ExecuteStatement
        String methodName = ProtocolGenerator.getDeserFunctionName(symbol, getName());
        String errorMethodName = methodName + "Error";
        // Add the normalized output type.
        String outputType = symbol.getName() + "Output";
        writer.addImport(outputType, outputType, symbol.getNamespace());

        // Handle the general response.
        writer.openBlock("export async function $L(\n"
                       + "  output: $T,\n"
                       + "  context: SerdeContext\n"
                       + "): Promise<$L> {", "}", methodName, responseType, outputType, () -> {
            // Redirect error deserialization to the dispatcher
            writer.openBlock("if (output.statusCode !== $L) {", "}", trait.getCode(), () -> {
                writer.write("return $L(output, context);", errorMethodName);
            });

            // Start deserializing the response.
            writer.write("let data: any = await parseBody(output.body, context)");
            writer.openBlock("let contents: $L = {", "};", outputType, () -> {
                writer.write("$$metadata: deserializeMetadata(output),");
                writer.write("__type: $S,", operation.getOutput().get().toString());
            });
            readHeaders(context, operation, bindingIndex);
            readResponseBody(context, operation, bindingIndex);
            writer.write("return Promise.resolve(contents);");
        });
        writer.write("");

        // Write out the error deserialization dispatcher.
        writer.openBlock("async function $L(\n"
                       + "  output: $T,\n"
                       + "  context: SerdeContext,\n"
                       + "): Promise<$L> {", "}", errorMethodName, responseType, outputType, () -> {
            writer.write("let data: any = await parseBody(output.body, context);");
            writer.write("let response: any;");
            writeErrorDeserializationDispatcher(context, operation.getErrors(), operation.getId().getNamespace());
            writer.write("return Promise.reject(response);");
        });
        writer.write("");
    }

    private void readHeaders(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        ShapeIndex index = context.getModel().getShapeIndex();
        for (HttpBinding binding : bindingIndex.getRequestBindings(operation, Location.HEADER)) {
            String memberName = symbolProvider.toMemberName(binding.getMember());
            writer.openBlock("if (output.headers[$L] !== undefined) {", "}", binding.getLocationName(), () -> {
                Shape target = index.getShape(binding.getMember().getTarget()).get();
                String headerValue = getOutputValue(context, binding.getLocation(),
                        "output.headers[" + binding.getLocationName() + "]", binding.getMember(), target);
                writer.write("contents.$L = $L;", memberName, headerValue);
            });
        }

        // Handle loading up prefix headers.
        List<HttpBinding> prefixHeaderBindings = bindingIndex.getResponseBindings(operation, Location.PREFIX_HEADERS);
        if (!prefixHeaderBindings.isEmpty()) {
            // Run through the headers one time, matching any prefix groups.
            writer.openBlock("Object.keys(output.headers).forEach(header -> {", "});", () -> {
                for (HttpBinding binding : prefixHeaderBindings) {
                    // Generate a single block for each group of prefix headers.
                    writer.openBlock("if (header.startsWith($L)) {", binding.getLocationName(), "}", () -> {
                        String memberName = symbolProvider.toMemberName(binding.getMember());
                        Shape target = context.getModel().getShapeIndex()
                                .getShape(binding.getMember().getTarget()).get();
                        String headerValue = getOutputValue(context, binding.getLocation(),
                                "output.headers[header]", binding.getMember(), target);

                        // Prepare a grab bag for these headers if necessary
                        writer.openBlock("if (contents.$L === undefined) {", "}", memberName, () -> {
                            writer.write("contents.$L: any = {};", memberName);
                        });

                        // Extract the non-prefix portion as the key.
                        writer.write("contents.$L[header.substring(header.length)] = $L;", memberName, headerValue);
                    });
                }
            });
        }
    }

    private void readResponseBody(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        List<HttpBinding> documentBindings = bindingIndex.getResponseBindings(operation, Location.DOCUMENT);
        documentBindings.sort(Comparator.comparing(HttpBinding::getMemberName));
        List<HttpBinding> payloadBindings = bindingIndex.getResponseBindings(operation, Location.PAYLOAD);

        if (!documentBindings.isEmpty()) {
            deserializeDocument(context, operation, documentBindings);
        }
        if (!payloadBindings.isEmpty()) {
            // There can only be one payload binding.
            HttpBinding binding = payloadBindings.get(0);
            Shape target = context.getModel().getShapeIndex().getShape(binding.getMember().getTarget()).get();
            writer.write("output.$L = $L;", binding.getMemberName(), getOutputValue(
                    context, Location.PAYLOAD, "data", binding.getMember(), target));
        }
    }

    private void readErrorBody(GenerationContext context, StructureShape shape) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(shape);
        String methodName = ProtocolGenerator.getDeserFunctionName(symbol, getName());

        writer.openBlock("const $L = (\n"
                       + "  output: any,\n"
                       + "  context: SerdeContext\n"
                       + "): $T => {", "};", methodName, symbol, () -> {
            // Initial contents of the error.
            writer.openBlock("let contents: $T = {", "};", symbol, () -> {
                writer.write("__type: $S,", shape.getId().toString());
                writer.write("$$name: $S,", shape.getId().getName());
                writer.write("$$fault: $S,", shape.getTrait(ErrorTrait.class).get().getValue());
            });
            // Read additional modeled content.
            deserializeError(context, shape);
            writer.write("return contents;");
        });
        writer.write("");
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * shape. This may use native types (like generating a Date for timestamps,)
     * converters (like a base64Decoder,) or invoke complex type deserializers to
     * manipulate the dataSource into the proper output content.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param member The member that points to the value being provided.
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the output value.
     */
    protected String getOutputValue(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            MemberShape member,
            Shape target
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();

        if (isNativeSimpleType(target)) {
            return dataSource;
        } else if (target instanceof TimestampShape) {
            // The Date class handles all of the input formats without needing to distinguish.
            return "new Date(" + dataSource + ")";
        } else if (target instanceof BlobShape) {
            return getBlobOutputParam(bindingType, dataSource);
        } else if (target instanceof CollectionShape) {
            return getCollectionOutputParam(context, bindingType, dataSource, target);
        } else if (target instanceof StructureShape || target instanceof UnionShape || target instanceof MapShape) {
            Symbol symbol = symbolProvider.toSymbol(target);
            return ProtocolGenerator.getDeserFunctionName(symbol, getName()) + "(" + dataSource + ", context)";
        }

        throw new CodegenException(String.format(
                "Unsupported %s binding of %s to %s in %s using the %s protocol",
                bindingType, member.getMemberName(), target.getType(), member.getContainer(), getName()));
    }

    private String getBlobOutputParam(Location bindingType, String dataSource) {
        switch (bindingType) {
            case PAYLOAD:
                return dataSource;
            case HEADER:
            case DOCUMENT:
                // Decode these from base64.
                return "context.base64Decoder.fromBase64(" + dataSource + ")";
            default:
                throw new CodegenException("Unexpected blob binding location `" + bindingType + "`");
        }
    }

    private String getCollectionOutputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            Shape target
    ) {
        switch (bindingType) {
            case HEADER:
                // Split these values on commas.
                return "(" + dataSource + " || \"\").split(',')";
            case DOCUMENT:
                SymbolProvider symbolProvider = context.getSymbolProvider();
                Symbol symbol = symbolProvider.toSymbol(target);

                return ProtocolGenerator.getDeserFunctionName(symbol, getName()) + "(" + dataSource +  ", context)";
            default:
                throw new CodegenException("Unexpected collection binding location `" + bindingType + "`");
        }
    }

    /**
     * Writes the code that dispatches to individual error deserializers. This should
     * also generate a default of an UnknownError using the passed namespace.
     *
     * <p>Implementations of this method are expected to determine the type of error,
     * dispatch to a function generated by {@code deserializeError}, and set that value
     * in the {@code response} variable. This variable will already be defined in scope.
     *
     * <p>If the error type is not able to be determined, a default
     * error should be generated with the given {@code unknownErrorNamespace}.
     *
     * <p>Two variables will be in scope:
     *   <ul>
     *       <li>{@code output}: a value of the HttpResponse type.</li>
     *       <li>{@code data}: the contents of the response body.</li>
     *   </ul>
     *
     * <p>For example, this function would generate:
     *
     * <pre>{@code
     *   switch (output.statusCode) {
     *     case 500:
     *       response = deserializeAws_restJson1_1ServiceUnavailableError(data, context);
     *       break;
     *     default:
     *       response = {
     *         __type: "com.smithy.example#UnknownError",
     *         $name: "UnknownError",
     *         $fault: "client",
     *       };
     *   }
     * }</pre>
     *
     * @param context The generation context.
     * @param errors The list of errors to dispatch to.
     * @param unknownErrorNamespace The namespace to use for the default error.
     */
    protected abstract void writeErrorDeserializationDispatcher(
            GenerationContext context,
            List<ShapeId> errors,
            String unknownErrorNamespace
    );

    /**
     * Writes the code needed to deserialize an error structure when received.
     *
     * <p>Implementations of this method are expected to generate a function body
     * that populates a {@code contents} variable that represents the error
     * generated from the response. This variable will already be defined in scope.
     *
     * <p>The function signature for this body will have two parameters:
     *   <ul>
     *     <li>{@code output}: a value representing the StructureShape error parameter.</li>
     *     <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example, this function would generate the following:
     *
     * <pre>{@code
     *   if (output.message !== undefined) {
     *     contents.message = output.message;
     *   }
     * }</pre>
     *
     * @param context The generation context.
     * @param error The error shape being generated.
     */
    protected abstract void deserializeError(GenerationContext context, StructureShape error);

    /**
     * Writes the code needed to deserialize the output document of a response.
     *
     * <p>Implementations of this method are expected to set members in the
     * {@code contents} variable that represents the type generated for the
     * response. This variable will already be defined in scope.
     *
     * The contents of the response body will be available in a {@code data} variable.
     *
     * <p>For example:
     *
     * <pre>{@code
     * if (data.fieldList !== undefined) {
     *   contents.fieldList = deserializeAws_restJson1_1FieldList(data.fieldList, context);
     * }
     * }</pre>
     *
     * @param context The generation context.
     * @param operation The operation being generated.
     * @param documentBindings The bindings to read from the document.
     */
    protected abstract void deserializeDocument(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    );

    /**
     * Writes the code needed to deserialize a structure in the document of a response.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns the type generated for the StructureShape {@code shape} parameter from an input
     * deserialized by {@code deserializeDocument}.
     *
     * <p>The function signature for this body will have two parameters:
     *   <ul>
     *     <li>{@code output}: a value representing the StructureShape shape parameter.</li>
     *     <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example, this function would generate the following:
     *
     * <pre>{@code
     *   let contents: any = {
     *     $namespace: "com.smithy.example",
     *     $name: "Field"
     *   };
     *   if (output.fooValue !== undefined) {
     *     contents.fooValue = deserializeAws_restJson1_1Foo(output.fooValue, context);
     *   }
     *   if (output.barValue !== undefined) {
     *     contents.barValue = output.barValue;
     *   }
     *   return contents;
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The structure shape being generated.
     */
    protected abstract void deserializeDocumentStructure(GenerationContext context, StructureShape shape);

    /**
     * Writes the code needed to deserialize a union in the document of a response.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns the type generated for the StructureShape {@code shape} parameter from an input
     * deserialized by {@code deserializeDocument}.
     *
     * <p>The function signature for this body will have two parameters:
     *   <ul>
     *     <li>{@code output}: a value representing the StructureShape shape parameter.</li>
     *     <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example, this function would generate the following:
     *
     * <pre>{@code
     *   if (output.fooValue !== undefined) {
     *     return {
     *       fooValue: deserializeAws_restJson1_1Foo(output.fooValue, context)
     *     };
     *   }
     *   if (output.barValue !== undefined) {
     *     return {
     *       barValue: output.barValue
     *     };
     *   }
     *   return { $unknown: output[Object.keys(output)[0]] };
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The union shape being generated.
     */
    protected abstract void deserializeDocumentUnion(GenerationContext context, UnionShape shape);

    /**
     * Writes the code needed to deserialize a collection in the document of a response.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns the type generated for the StructureShape {@code shape} parameter from an input
     * deserialized by {@code deserializeDocument}.
     *
     * <p>The function signature for this body will have two parameters:
     *   <ul>
     *     <li>{@code output}: a value representing the StructureShape shape parameter.</li>
     *     <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example, this function would generate the following:
     *
     * <pre>{@code
     *   return (output || []).map((entry: any) =>
     *     deserializeAws_restJson1_1Parameter(entry, context)
     *   );
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The collection shape being generated.
     */
    protected abstract void deserializeDocumentCollection(GenerationContext context, CollectionShape shape);

    /**
     * Writes the code needed to deserialize a map in the document of a response.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns the type generated for the StructureShape {@code shape} parameter from an input
     * deserialized by {@code deserializeDocument}.
     *
     * <p>The function signature for this body will have two parameters:
     *   <ul>
     *     <li>{@code output}: a value representing the StructureShape shape parameter.</li>
     *     <li>{@code context}: the SerdeContext.</li>
     *   </ul>
     *
     * <p>For example, this function would generate the following:
     *
     * <pre>{@code
     *   let mapParams: any = {};
     *   Object.keys(output).forEach(key => {
     *     mapParams[key] = deserializeAws_restJson1_1Field(output[key], context);
     *   });
     *   return mapParams;
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The map shape being generated.
     */
    protected abstract void deserializeDocumentMap(GenerationContext context, MapShape shape);

    private boolean isNativeSimpleType(Shape target) {
        return target instanceof BooleanShape || target instanceof DocumentShape
                || target instanceof NumberShape || target instanceof StringShape;
    }

    private final class ShapeSerializingVisitor extends ShapeVisitor.Default<Void> {
        private GenerationContext context;
        private boolean isInput;

        ShapeSerializingVisitor(GenerationContext context, boolean isInput) {
            this.context = context;
            this.isInput = isInput;
        }

        @Override
        protected Void getDefault(Shape shape) {
            return null;
        }

        private Void generateFunctionSignature(Shape shape, BiConsumer<GenerationContext, Shape> functionBody) {
            SymbolProvider symbolProvider = context.getSymbolProvider();
            TypeScriptWriter writer = context.getWriter();

            // Handle the various symbol naming and positional toggling needed.
            String varName = isInput ? "input" : "output";
            Symbol symbol = symbolProvider.toSymbol(shape);
            String parameterType = isInput ? symbol.getName() : "any";
            String responseType = isInput ? "any" : symbol.getName();
            // Use the shape name for the function name.
            String methodName = isInput
                    ? ProtocolGenerator.getSerFunctionName(symbol, getName())
                    : ProtocolGenerator.getDeserFunctionName(symbol, getName());

            writer.addImport(symbol, symbol.getName());
            writer.openBlock("const $L = (\n"
                           + "  $L: $L,\n"
                           + "  context: SerdeContext\n"
                           + "): $L => {", "}", methodName, varName, parameterType, responseType, () -> {
                functionBody.accept(context, shape);
            });
            writer.write("");
            return null;
        }

        /**
         * Dispatches to create the body of list shape serde functions.
         * The function signature will be generated.
         *
         * <p>For example, given the following Smithy model:
         *
         * <pre>{@code
         * list ParameterList {
         *     member: Parameter
         * }
         * }</pre>
         *
         * <p>The following code is generated for a serializer:
         *
         * <pre>{@code
         * const serializeAws_restJson1_1ParametersList = (
         *   input: Array<Parameter>,
         *   context: SerdeContext
         * ): any => {
         *   return (input || []).map(entry =>
         *     serializeAws_restJson1_1Parameter(entry, context)
         *   );
         * }
         * }</pre>
         *
         *
         * <p>And the following code is generated for a deserializer</p>
         *
         * <pre>{@code
         * const deserializeAws_restJson1_1ParameterList = (
         *   output: any,
         *   context: SerdeContext
         * ): Array<Parameter> => {
         *   return (output || []).map((entry: any) =>
         *     deserializeAws_restJson1_1Parameter(entry, context)
         *   );
         * }
         * }</pre>
         *
         * @param shape The list shape to generate serde for.
         * @return Null.
         */
        @Override
        public Void listShape(ListShape shape) {
            generateFunctionSignature(shape, (c, s) -> {
                if (isInput) {
                    serializeDocumentCollection(c, s.asListShape().get());
                } else {
                    deserializeDocumentCollection(c, s.asListShape().get());
                }
            });
            return shape.getMember().accept(this);
        }

        /**
         * Dispatches to create the body of set shape serde functions.
         * The function signature will be generated.
         *
         * <p>For example, given the following Smithy model:
         *
         * <pre>{@code
         * set ParameterSet {
         *     member: Parameter
         * }
         * }</pre>
         *
         * <p>The following code is generated for a serializer:
         *
         * <pre>{@code
         * const serializeAws_restJson1_1ParametersSet = (
         *   input: Set<Parameter>,
         *   context: SerdeContext
         * ): any => {
         *   return (input || []).map(entry =>
         *     serializeAws_restJson1_1Parameter(entry, context)
         *   );
         * }
         * }</pre>
         *
         *
         * <p>And the following code is generated for a deserializer</p>
         *
         * <pre>{@code
         * const deserializeAws_restJson1_1ParameterSet = (
         *   output: any,
         *   context: SerdeContext
         * ): Set<Parameter> => {
         *   return (output || []).map((entry: any) =>
         *     deserializeAws_restJson1_1Parameter(entry, context)
         *   );
         * }
         * }</pre>
         *
         * @param shape The set shape to generate serde for.
         * @return Null.
         */
        @Override
        public Void setShape(SetShape shape) {
            generateFunctionSignature(shape, (c, s) -> {
                if (isInput) {
                    serializeDocumentCollection(c, s.asSetShape().get());
                } else {
                    deserializeDocumentCollection(c, s.asSetShape().get());
                }
            });
            return shape.getMember().accept(this);
        }

        /**
         * Dispatches to create the body of map shape serde functions.
         * The function signature will be generated.
         *
         * <p>For example, given the following Smithy model:
         *
         * <pre>{@code
         * map FieldMap {
         *     key: String,
         *     value: Field
         * }
         * }</pre>
         *
         * <p>The following code is generated for a serializer:
         *
         * <pre>{@code
         * const serializeAws_restJson1_1FieldMap = (
         *   input: { [key: string]: Field },
         *   context: SerdeContext
         * ): any => {
         *   let mapParams: any = {};
         *   Object.keys(input).forEach(key => {
         *     mapParams[key] = serializeAws_restJson1_1Field(input[key], context);
         *   });
         *   return mapParams;
         * }
         * }</pre>
         *
         *
         * <p>And the following code is generated for a deserializer</p>
         *
         * <pre>{@code
         * const deserializeAws_restJson1_1FieldMap = (
         *   output: any,
         *   context: SerdeContext
         * ): { [key: string]: Field } => {
         *   let mapParams: any = {};
         *   Object.keys(output).forEach(key => {
         *     mapParams[key] = deserializeAws_restJson1_1Field(output[key], context);
         *   });
         *   return mapParams;
         * }
         * }</pre>
         * @param shape The map shape to generate serde for.
         * @return Null.
         */
        @Override
        public Void mapShape(MapShape shape) {
            generateFunctionSignature(shape, (c, s) -> {
                if (isInput) {
                    serializeDocumentMap(c, s.asMapShape().get());
                } else {
                    deserializeDocumentMap(c, s.asMapShape().get());
                }
            });
            return shape.getValue().accept(this);
        }

        /**
         * Dispatches to create the body of structure shape serde functions.
         * The function signature will be generated.
         *
         * <p>For example, given the following Smithy model:
         *
         * <pre>{@code
         * structure Field {
         *     fooValue: Foo,
         *     barValue: String,
         * }
         * }</pre>
         *
         * <p>The following code is generated for a serializer:
         *
         * <pre>{@code
         * const serializeAws_restJson1_1Field = (
         *   input: Field,
         *   context: SerdeContext
         * ): any => {
         *   let bodyParams: any = {}
         *   if (input.fooValue !== undefined) {
         *     bodyParams['fooValue'] = serializeAws_restJson1_1Foo(input.fooValue, context);
         *   }
         *   if (input.barValue !== undefined) {
         *     bodyParams['barValue'] = input.barValue;
         *   }
         *   return bodyParams;
         * }
         * }</pre>
         *
         *
         * <p>And the following code is generated for a deserializer</p>
         *
         * <pre>{@code
         * const deserializeAws_restJson1_1Field = (
         *   output: any,
         *   context: SerdeContext
         * ): Field => {
         *   let field: any = {
         *     $namespace: "com.smithy.example",
         *     $name: "Field"
         *   };
         *   if (output.fooValue !== undefined) {
         *     field.fooValue = deserializeAws_restJson1_1Foo(output.fooValue, context);
         *   }
         *   if (output.barValue !== undefined) {
         *     field.barValue = output.barValue;
         *   }
         *   return field;
         * }
         * }</pre>
         *
         * @param shape The structure shape to generate serde for.
         * @return Null.
         */
        @Override
        public Void structureShape(StructureShape shape) {
            generateFunctionSignature(shape, (c, s) -> {
                if (isInput) {
                    serializeDocumentStructure(c, s.asStructureShape().get());
                } else {
                    deserializeDocumentStructure(c, s.asStructureShape().get());
                }
            });
            shape.getAllMembers().values().forEach(member -> member.accept(this));
            return null;
        }

        /**
         * Dispatches to create the body of union shape serde functions.
         * The function signature will be generated.
         *
         * <p>For example, given the following Smithy model:
         *
         * <pre>{@code
         * union Field {
         *     fooValue: Foo,
         *     barValue: String,
         * }
         * }</pre>
         *
         * <p>The following code is generated for a serializer:
         *
         * <pre>{@code
         * const serializeAws_restJson1_1Field = (
         *   input: Field,
         *   context: SerdeContext
         * ): any => {
         *   return Field.visit(input, {
         *     fooValue: value => serializeAws_restJson1_1Foo(value, context),
         *     barValue: value => value,
         *     _: value => value
         *   });
         * }
         * }</pre>
         *
         *
         * <p>And the following code is generated for a deserializer</p>
         *
         * <pre>{@code
         * const deserializeAws_restJson1_1Field = (
         *   output: any,
         *   context: SerdeContext
         * ): Field => {
         *   if (output.fooValue !== undefined) {
         *     return {
         *       fooValue: deserializeAws_restJson1_1Foo(output.fooValue, context)
         *     };
         *   }
         *   if (output.barValue !== undefined) {
         *     return {
         *       barValue: output.barValue
         *     };
         *   }
         *   return { $unknown: output[Object.keys(output)[0]] };
         * }
         * }</pre>
         *
         * @param shape The union shape to generate serde for.
         * @return Null.
         */
        @Override
        public Void unionShape(UnionShape shape) {
            generateFunctionSignature(shape, (c, s) -> {
                if (isInput) {
                    serializeDocumentUnion(c, s.asUnionShape().get());
                } else {
                    deserializeDocumentUnion(c, s.asUnionShape().get());
                }
            });
            shape.getAllMembers().values().forEach(member -> member.accept(this));
            return null;
        }
    }
}
