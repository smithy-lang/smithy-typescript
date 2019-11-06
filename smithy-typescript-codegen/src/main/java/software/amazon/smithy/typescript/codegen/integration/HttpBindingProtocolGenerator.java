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

import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
import software.amazon.smithy.model.shapes.ShapeIndex;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.SimpleShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.UnionShape;
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

    @Override
    public void generateSharedComponents(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();

        SymbolReference responseType = getApplicationProtocol().getResponseType();
        writer.addImport("ResponseMetadata", "ResponseMetadata", "@aws-sdk/types");
        writer.openBlock("const deserializeMetadata = (output: $T): ResponseMetadata => ({", "});", responseType,
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
        SymbolProvider symbolProvider = context.getSymbolProvider();
        TypeScriptWriter writer = context.getWriter();

        // Track the shapes we need to generate sub-serializers for.
        Set<Shape> serializingShapes = new HashSet<>();
        for (OperationShape operation : topDownIndex.getContainedOperations(context.getService())) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationSerializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol request bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));

            operationIndex.getInput(operation)
                    .ifPresent(input -> serializingShapes.addAll(shapeWalker.walkShapes(input).stream()
                            // Don't generate a sub-serializer for the actual input shape.
                            .filter(s -> !input.equals(s))
                            .collect(Collectors.toSet())));
        }

        // TODO Abstraction point
        // This should almost certainly be abstracted out to something else, because any protocol
        // with a document body is going to need to generate sub-serializers.
        // Generate the serializers for shapes within the operation closure.
        serializingShapes.forEach(shape -> shape.accept(new ShapeVisitor.Default<Void>() {
            @Override
            protected Void getDefault(Shape shape) {
                return null;
            }

            private Void generateFunctionSignature(Shape shape, BiConsumer<GenerationContext, Shape> functionBody) {
                Symbol symbol = symbolProvider.toSymbol(shape);
                // Use the shape name for the function name.
                String methodName = ProtocolGenerator.getSerFunctionName(symbol, getName());
                writer.openBlock("const $L = (\n"
                        + "  input: $T,\n"
                        + "  context: SerdeContext\n"
                        + "): any => {", "}", methodName, symbol, () -> {
                    functionBody.accept(context, shape);
                });
                writer.write("");
                return null;
            }

            @Override
            public Void listShape(ListShape shape) {
                // TODO Collection cleanup point
                // There's a decent bit of this "collections are different" work in here, meaning
                // there's likely to also be that in the implementations. There should be both a
                // centralized way to check for and/or handle these differences.
                Shape target = context.getModel().getShapeIndex().getShape(shape.getMember().getTarget()).get();
                if (target instanceof SimpleShape) {
                    return null;
                }
                generateFunctionSignature(shape, (c, s) -> serializeDocumentCollection(c, s.asListShape().get()));
                return shape.getMember().accept(this);
            }

            @Override
            public Void setShape(SetShape shape) {
                // TODO See collection cleanup note
                Shape target = context.getModel().getShapeIndex().getShape(shape.getMember().getTarget()).get();
                if (target instanceof SimpleShape) {
                    return null;
                }
                generateFunctionSignature(shape, (c, s) -> serializeDocumentCollection(c, s.asSetShape().get()));
                return shape.getMember().accept(this);
            }

            @Override
            public Void mapShape(MapShape shape) {
                generateFunctionSignature(shape, (c, s) -> serializeDocumentMap(c, s.asMapShape().get()));
                return shape.getValue().accept(this);
            }

            @Override
            public Void structureShape(StructureShape shape) {
                generateFunctionSignature(shape, (c, s) -> serializeDocumentStructure(c, s.asStructureShape().get()));
                shape.getAllMembers().values().forEach(member -> member.accept(this));
                return null;
            }

            @Override
            public Void unionShape(UnionShape shape) {
                generateFunctionSignature(shape, (c, s) -> serializeDocumentUnion(c, s.asUnionShape().get()));
                shape.getAllMembers().values().forEach(member -> member.accept(this));
                return null;
            }
        }));
    }

    @Override
    public void generateResponseDeserializers(GenerationContext context) {
        TopDownIndex topDownIndex = context.getModel().getKnowledge(TopDownIndex.class);
        for (OperationShape operation : topDownIndex.getContainedOperations(context.getService())) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationDeserializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol response bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));
        }
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
                    String labelValue = getInputValue(context, binding.getLocation(),
                            operation, binding.getMember(), target);
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
                    String queryValue = getInputValue(context, binding.getLocation(),
                            operation, binding.getMember(), target);
                    writer.write("query['$L'] = $L;", binding.getLocationName(), queryValue);
                });
            }
        }

        return queryBindings;
    }

    protected String getInputValue(
            GenerationContext context,
            Location bindingType,
            Shape shape,
            MemberShape member,
            Shape target
    ) {
        String memberName = member.getMemberName();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        if (target instanceof StringShape || target instanceof DocumentShape) {
            return "input." + memberName;
        } else if (target instanceof BooleanShape || target instanceof NumberShape) {
            // Just toString on the value.
            return "input." + memberName + ".toString()";
        } else if (target instanceof TimestampShape) {
            HttpBindingIndex httpIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
            Format format = httpIndex.determineTimestampFormat(member, bindingType, getDocumentTimestampFormat());
            return getTimestampInputParam(member, format);
        } else if (target instanceof BlobShape) {
            return getBlobInputParam(member, bindingType);
        } else if (target instanceof CollectionShape) {
            return getCollectionInputParam(context, bindingType, shape, member, target);
        } else if (target instanceof StructureShape || target instanceof UnionShape || target instanceof MapShape) {
            Symbol symbol = symbolProvider.toSymbol(target);
            String value = ProtocolGenerator.getSerFunctionName(symbol, getName()) + "(";
            // Collections map over the input entries, so use that.
            // TODO See collection cleanup note
            if (shape instanceof CollectionShape) {
                value += "entry";
            } else {
                value += "input." + memberName;
            }
            return value + ", context)";
        }

        throw new CodegenException(String.format(
                "Unsupported %s binding of %s to %s in %s using the %s protocol",
                bindingType, memberName, target.getType(), shape, getName()));
    }

    private String getTimestampInputParam(MemberShape member, Format format) {
        switch (format) {
            case DATE_TIME:
                return "input." + member.getMemberName() + ".toISOString()";
            case EPOCH_SECONDS:
                return "Math.round(input." + member.getMemberName() + ".getTime() / 1000)";
            case HTTP_DATE:
                return "input." + member.getMemberName() + ".toUTCString()";
            default:
                throw new CodegenException("Unexpected timestamp format `" + format.toString() + "` on " + member);
        }
    }

    private String getBlobInputParam(MemberShape member, Location bindingType) {
        String memberName = member.getMemberName();
        switch (bindingType) {
            case PAYLOAD:
                return "input." + memberName;
            case HEADER:
            case DOCUMENT:
            case QUERY:
                // Encode these to base64.
                return "context.base64Encoder.toBase64(input." + memberName + ")";
            default:
                throw new CodegenException("Unexpected blob binding location`" + bindingType);
        }
    }

    private String getCollectionInputParam(
            GenerationContext context,
            Location bindingType,
            Shape shape,
            MemberShape member,
            Shape target
    ) {
        String memberName = member.getMemberName();
        switch (bindingType) {
            case HEADER:
                // TODO Is special handling needed for string contents with commas and/or newlines?
                // Join these values with commas.
                return "input." + memberName + ".toString()";
            case DOCUMENT:
                SymbolProvider symbolProvider = context.getSymbolProvider();
                Symbol symbol = symbolProvider.toSymbol(target);

                String value = ProtocolGenerator.getSerFunctionName(symbol, getName()) + "(";
                // Collections map over the input directly, so use only that.
                // TODO See collection cleanup note
                if (shape instanceof CollectionShape) {
                    value += "entry";
                } else {
                    value += "input." + symbolProvider.toMemberName(member);
                }
                return value + ", context)";
            case QUERY:
                return "input." + memberName;
            default:
                throw new CodegenException("Unexpected collection binding location`" + bindingType);
        }
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

        ShapeIndex index = context.getModel().getShapeIndex();
        for (HttpBinding binding : bindingIndex.getRequestBindings(operation, Location.HEADER)) {
            String memberName = symbolProvider.toMemberName(binding.getMember());
            writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
                Shape target = index.getShape(binding.getMember().getTarget()).get();
                String headerValue = getInputValue(context, binding.getLocation(),
                        operation, binding.getMember(), target);
                writer.write("headers['$L'] = $L;", binding.getLocationName(), headerValue);
            });
        }

        // Handle assembling prefix headers.
        for (HttpBinding binding : bindingIndex.getRequestBindings(operation, Location.PREFIX_HEADERS)) {
            String memberName = symbolProvider.toMemberName(binding.getMember());
            writer.openBlock("Objects.keys(input.$L).forEach(suffix -> {", "});", memberName, () -> {
                writer.write("headers['$L' + suffix] = input.$L[suffix];", binding.getLocationName(), memberName);
            });
        }
    }

    private List<HttpBinding> writeRequestBody(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        List<HttpBinding> documentBindings = bindingIndex.getRequestBindings(operation, Location.DOCUMENT);
        List<HttpBinding> payloadBindings = bindingIndex.getRequestBindings(operation, Location.PAYLOAD);
        if (!documentBindings.isEmpty()) {
            // Write the default `body` property.
            context.getWriter().write("let body: any = undefined;");
            serializeDocument(context, operation, bindingIndex.getRequestBindings(operation, Location.DOCUMENT));
            return documentBindings;
        }
        if (!payloadBindings.isEmpty()) {
            // There can only be one payload binding.
            HttpBinding binding = payloadBindings.get(0);
            Shape target = context.getModel().getShapeIndex().getShape(binding.getMember().getTarget()).get();
            writer.write("let body: any = $L;", getInputValue(
                    context, Location.PAYLOAD, operation, binding.getMember(), target));
            return payloadBindings;
        }

        return ListUtils.of();
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

    /**
     * Writes the code needed to serialize the input document of a request.
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
     * @param context The generation context.
     * @param shape The structure shape being generated.
     */
    protected abstract void serializeDocumentStructure(
            GenerationContext context,
            StructureShape shape
    );

    /**
     * Writes the code needed to serialize a union in the document of a request.
     *
     * @param context The generation context.
     * @param shape The union shape being generated.
     */
    protected abstract void serializeDocumentUnion(
            GenerationContext context,
            UnionShape shape
    );

    /**
     * Writes the code needed to serialize a collection in the document of a request.
     *
     * @param context The generation context.
     * @param shape The collection shape being generated.
     */
    protected abstract void serializeDocumentCollection(
            GenerationContext context,
            CollectionShape shape
    );

    /**
     * Writes the code needed to serialize a map in the document of a request.
     *
     * @param context The generation context.
     * @param shape The map shape being generated.
     */
    protected abstract void serializeDocumentMap(
            GenerationContext context,
            MapShape shape
    );

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

        // Add the normalized output type.
        String outputType = symbol.getName() + "Output";
        writer.addImport(outputType, outputType, symbol.getNamespace());

        writer.openBlock("export function $L(\n"
                         + "  output: $T,\n"
                         + "  context: SerdeContext\n"
                         + "): Promise<$L> {", "}", methodName, responseType, outputType, () -> {
            // TODO: Check status code to create appropriate error type or response type.
            writeHeaders(context, operation, bindingIndex);
            // TODO: response body deserialization.
        });

        writer.write("");
    }
}
