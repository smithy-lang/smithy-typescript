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
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.knowledge.HttpBindingIndex;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.pattern.Pattern.Segment;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.BooleanShape;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.DoubleShape;
import software.amazon.smithy.model.shapes.FloatShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.NumberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.EndpointTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.EventHeaderTrait;
import software.amazon.smithy.model.traits.EventPayloadTrait;
import software.amazon.smithy.model.traits.EventStreamTrait;
import software.amazon.smithy.model.traits.HttpTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.OptionalUtils;

/**
 * Abstract implementation useful for all protocols that use HTTP bindings.
 */
//TODO: check ending ;
public abstract class HttpBindingProtocolGenerator implements ProtocolGenerator {

    private static final Logger LOGGER = Logger.getLogger(HttpBindingProtocolGenerator.class.getName());

    private final Set<Shape> serializingDocumentShapes = new TreeSet<>();
    private final Set<Shape> deserializingDocumentShapes = new TreeSet<>();
    private final Set<StructureShape> deserializingErrorShapes = new TreeSet<>();
    private final Set<StructureShape> serializeEventShapes = new TreeSet<>();
    private final Set<StructureShape> deserializingEventShapes = new TreeSet<>();
    private final Set<UnionShape> serializeEventUnions = new TreeSet<>();
    private final Set<UnionShape> deserializeEventUnions = new TreeSet<>();
    private final boolean isErrorCodeInBody;

    /**
     * Creates a Http binding protocol generator.
     *
     * @param isErrorCodeInBody A boolean that indicates if the error code for the implementing protocol is located in
     *   the error response body, meaning this generator will parse the body before attempting to load an error code.
     */
    public HttpBindingProtocolGenerator(boolean isErrorCodeInBody) {
        this.isErrorCodeInBody = isErrorCodeInBody;
    }

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

    /**
     * Generates serialization functions for shapes in the passed set. These functions
     * should return a value that can then be serialized by the implementation of
     * {@code serializeInputDocument}. The {@link DocumentShapeSerVisitor} and {@link DocumentMemberSerVisitor}
     * are provided to reduce the effort of this implementation.
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
        serializeEventUnions.forEach(eventUnion -> generateSerializingEventUnion(context, eventUnion));
        deserializeEventUnions.forEach(eventUnion -> generateDeserializingEventUnion(context, eventUnion));
        serializeEventShapes.forEach(event -> generateEventSerializer(context, event));
        deserializingEventShapes.forEach(event -> generateEventDeserializer(context, event));
        deserializingErrorShapes.forEach(error -> generateErrorDeserializer(context, error));
        generateDocumentBodyShapeSerializers(context, serializingDocumentShapes);
        generateDocumentBodyShapeDeserializers(context, deserializingDocumentShapes);
        HttpProtocolGeneratorUtils.generateMetadataDeserializer(context, getApplicationProtocol().getResponseType());
        HttpProtocolGeneratorUtils.generateCollectBody(context);
        HttpProtocolGeneratorUtils.generateCollectBodyString(context);
        HttpProtocolGeneratorUtils.generateHttpBindingUtils(context);
    }

    /**
     * Detects if the target shape is expressed as a native simple type.
     *
     * @param target The shape of the value being provided.
     * @return Returns if the shape is a native simple type.
     */
    private boolean isNativeSimpleType(Shape target) {
        return target instanceof BooleanShape || target instanceof DocumentShape
                       || target instanceof NumberShape || target instanceof StringShape;
    }

    @Override
    public void generateRequestSerializers(GenerationContext context) {
        TopDownIndex topDownIndex = context.getModel().getKnowledge(TopDownIndex.class);

        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));
        for (OperationShape operation : containedOperations) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationSerializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol request bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));
        }
    }

    @Override
    public void generateResponseDeserializers(GenerationContext context) {
        TopDownIndex topDownIndex = context.getModel().getKnowledge(TopDownIndex.class);

        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));
        for (OperationShape operation : containedOperations) {
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
        writer.addImport("Endpoint", "__Endpoint", "@aws-sdk/types");
        // e.g., serializeAws_restJson1_1ExecuteStatement
        String methodName = ProtocolGenerator.getSerFunctionName(symbol, getName());
        // Add the normalized input type.
        Symbol inputType = symbol.expectProperty("inputType", Symbol.class);
        String contextType = CodegenUtils.getOperationSerializerContextType(writer, context.getModel(), operation);

        writer.openBlock("export async function $L(\n"
                       + "  input: $T,\n"
                       + "  context: $L\n"
                       + "): Promise<$T> {", "}", methodName, inputType, contextType, requestType, () -> {
            writeHeaders(context, operation, bindingIndex);
            writeResolvedPath(context, operation, bindingIndex, trait);
            boolean hasQueryComponents = writeRequestQueryString(context, operation, bindingIndex, trait);
            List<HttpBinding> bodyBindings = writeRequestBody(context, operation, bindingIndex);
            boolean hasHostPrefix = operation.hasTrait(EndpointTrait.class);

            if (hasHostPrefix) {
                HttpProtocolGeneratorUtils.writeHostPrefix(context, operation);
            }

            // Get the hostname, port, and scheme from client's resolved endpoint. Then construct the request from
            // them. The client's resolved endpoint can be default one or supplied by users.
            writer.write("const {hostname, protocol = \"https\", port} = await context.endpoint();");
            writer.openBlock("return new $T({", "});", requestType, () -> {
                if (hasHostPrefix) {
                    writer.write("hostname: resolvedHostname,");
                }
                writer.write("protocol,");
                writer.write("hostname,");
                writer.write("port,");
                writer.write("method: $S,", trait.getMethod());
                writer.write("headers,");
                writer.write("path: resolvedPath,");
                if (hasQueryComponents) {
                    writer.write("query,");
                }
                if (!bodyBindings.isEmpty()) {
                    // Track all shapes bound to the body so their serializers may be generated.
                    bodyBindings.stream()
                            .map(HttpBinding::getMember)
                            .map(member -> context.getModel().expectShape(member.getTarget()))
                            .forEach(serializingDocumentShapes::add);
                }
                // Always set the body,
                writer.write("body,");
            });
        });

        writer.write("");
    }

    private void writeResolvedPath(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex,
            HttpTrait trait
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        List<HttpBinding> labelBindings = bindingIndex.getRequestBindings(operation, Location.LABEL);

        // Always write the bound path, but only the actual segments.
        writer.write("let resolvedPath = $S;", "/" + trait.getUri().getSegments().stream()
                .map(Segment::toString)
                .collect(Collectors.joining("/")));

        // Handle any label bindings.
        if (!labelBindings.isEmpty()) {
            Model model = context.getModel();
            List<Segment> uriLabels = trait.getUri().getLabels();
            for (HttpBinding binding : labelBindings) {
                String memberName = symbolProvider.toMemberName(binding.getMember());
                Shape target = model.expectShape(binding.getMember().getTarget());
                String labelValue = getInputValue(context, binding.getLocation(), "input." + memberName,
                        binding.getMember(), target);
                // Get the correct label to use.
                Segment uriLabel = uriLabels.stream().filter(s -> s.getContent().equals(memberName)).findFirst().get();
                writer.addImport("extendedEncodeURIComponent", "__extendedEncodeURIComponent",
                        "@aws-sdk/smithy-client");
                String encodedSegment = uriLabel.isGreedyLabel()
                        ? "labelValue.split(\"/\").map(segment => __extendedEncodeURIComponent(segment)).join(\"/\")"
                        : "__extendedEncodeURIComponent(labelValue)";

                // Set the label's value and throw a clear error if empty or undefined.
                writer.write("if (input.$L !== undefined) {", memberName).indent()
                    .write("const labelValue: string = $L;", labelValue)
                    .openBlock("if (labelValue.length <= 0) {", "}", () -> {
                        writer.write("throw new Error('Empty value provided for input HTTP label: $L.');", memberName);
                    })
                    .write("resolvedPath = resolvedPath.replace($S, $L);", uriLabel.toString(), encodedSegment).dedent()
                .write("} else {").indent()
                    .write("throw new Error('No value provided for input HTTP label: $L.');", memberName).dedent()
                .write("}");
            }
        }
    }

    private boolean writeRequestQueryString(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex,
            HttpTrait trait
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        List<HttpBinding> queryBindings = bindingIndex.getRequestBindings(operation, Location.QUERY);

        // Build the initial query bag.
        Map<String, String> queryLiterals = trait.getUri().getQueryLiterals();
        if (!queryLiterals.isEmpty()) {
            // Write any query literals present in the uri.
            writer.openBlock("const query: any = {", "};",
                    () -> queryLiterals.forEach((k, v) -> writer.write("$S: $S,", k, v)));
        } else if (!queryBindings.isEmpty()) {
            writer.write("const query: any = {};");
        }

        // Handle any additional query bindings.
        if (!queryBindings.isEmpty()) {
            Model model = context.getModel();
            for (HttpBinding binding : queryBindings) {
                String memberName = symbolProvider.toMemberName(binding.getMember());
                writer.addImport("extendedEncodeURIComponent", "__extendedEncodeURIComponent",
                        "@aws-sdk/smithy-client");
                writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
                    Shape target = model.expectShape(binding.getMember().getTarget());
                    String queryValue = getInputValue(context, binding.getLocation(), "input." + memberName,
                            binding.getMember(), target);
                    writer.write("query[$S] = $L;", binding.getLocationName(), queryValue);
                });
            }
        }

        // Any binding or literal means we generated a query bag.
        return !queryBindings.isEmpty() || !queryLiterals.isEmpty();
    }

    private void writeHeaders(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        // Headers are always present either from the default document or the payload.
        writer.write("const headers: any = {};");
        writer.write("headers['Content-Type'] = $S;", bindingIndex.determineRequestContentType(
                operation, getDocumentContentType()));
        writeDefaultHeaders(context, operation);

        operation.getInput().ifPresent(outputId -> {
            Model model = context.getModel();
            for (HttpBinding binding : bindingIndex.getRequestBindings(operation, Location.HEADER)) {
                String memberLocation = "input." + symbolProvider.toMemberName(binding.getMember());
                writer.openBlock("if (isSerializableHeaderValue($1L)) {", "}", memberLocation, () -> {
                    Shape target = model.expectShape(binding.getMember().getTarget());
                    String headerValue = getInputValue(context, binding.getLocation(), memberLocation + "!",
                            binding.getMember(), target);
                    writer.write("headers[$S] = $L;", binding.getLocationName(), headerValue);
                });
            }

            // Handle assembling prefix headers.
            for (HttpBinding binding : bindingIndex.getRequestBindings(operation, Location.PREFIX_HEADERS)) {
                String memberLocation = "input." + symbolProvider.toMemberName(binding.getMember());
                writer.openBlock("if ($L !== undefined) {", "}", memberLocation, () -> {
                    MapShape prefixMap = model.expectShape(binding.getMember().getTarget()).asMapShape().get();
                    Shape target = model.expectShape(prefixMap.getValue().getTarget());
                    // Iterate through each entry in the member.
                    writer.openBlock("Object.keys($L).forEach(suffix => {", "});", memberLocation, () -> {
                        // Use a ! since we already validated the input member is defined above.
                        String headerValue = getInputValue(context, binding.getLocation(),
                                memberLocation + "![suffix]", binding.getMember(), target);
                        // Append the suffix to the defined prefix and serialize the value in to that key.
                        writer.write("headers[$S + suffix] = $L;", binding.getLocationName(), headerValue);
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
        // Write the default `body` property.
        writer.write("let body: any;");

        // Handle a payload binding explicitly.
        List<HttpBinding> payloadBindings = bindingIndex.getRequestBindings(operation, Location.PAYLOAD);
        if (!payloadBindings.isEmpty()) {
            // There can only be one payload binding.
            HttpBinding payloadBinding = payloadBindings.get(0);
            serializeInputPayload(context, operation, payloadBinding);
            return payloadBindings;
        }

        // If we have document bindings or need a defaulted request body,
        // use the input document serialization.
        List<HttpBinding> documentBindings = bindingIndex.getRequestBindings(operation, Location.DOCUMENT);
        if (!documentBindings.isEmpty() || bindingIndex.getRequestBindings(operation).isEmpty()) {
            documentBindings.sort(Comparator.comparing(HttpBinding::getMemberName));

            serializeInputDocument(context, operation, documentBindings);
            return documentBindings;
        }

        // Otherwise, we have no bindings to add shapes from.
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
        if (target instanceof StringShape) {
            return HttpProtocolGeneratorUtils.getStringInputParam(context, target, dataSource);
        } else if (target instanceof FloatShape || target instanceof DoubleShape) {
            // Handle decimal numbers needing to have .0 in their value when whole numbers.
            return "((" + dataSource + " % 1 == 0) ? " + dataSource + " + \".0\" : " + dataSource + ".toString())";
        } else if (isNativeSimpleType(target)) {
            return dataSource + ".toString()";
        } else if (target instanceof TimestampShape) {
            return getTimestampInputParam(context, bindingType, dataSource, member);
        } else if (target instanceof BlobShape) {
            return getBlobInputParam(bindingType, dataSource);
        } else if (target instanceof CollectionShape) {
            return getCollectionInputParam(context, bindingType, dataSource, (CollectionShape) target);
        } else if (target instanceof StructureShape || target instanceof UnionShape) {
            return getNamedMembersInputParam(context, bindingType, dataSource, target);
        }

        throw new CodegenException(String.format(
                "Unsupported %s binding of %s to %s in %s using the %s protocol",
                bindingType, member.getMemberName(), target.getType(), member.getContainer(), getName()));
    }

    /**
     * Given context and a source of data, generate an input value provider for the
     * blob. By default, this base64 encodes content in headers and query strings,
     * and passes through for payloads.
     *
     * @param bindingType How this value is bound to the operation input.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @return Returns a value or expression of the input blob.
     */
    private String getBlobInputParam(Location bindingType, String dataSource) {
        switch (bindingType) {
            case PAYLOAD:
                return dataSource;
            case HEADER:
            case QUERY:
                // Encode these to base64.
                return "context.base64Encoder(" + dataSource + ")";
            default:
                throw new CodegenException("Unexpected blob binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an input value provider for the
     * collection. By default, this separates the list with commas in headers, and
     * relies on the HTTP implementation for query strings.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation input.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the input collection.
     */
    private String getCollectionInputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            CollectionShape target
    ) {
        MemberShape targetMember = target.getMember();
        Shape collectionTarget = context.getModel().expectShape(targetMember.getTarget());
        // Use a basic array to serialize this more easily.
        if (target.isSetShape()) {
            dataSource = "Array.from(" + dataSource + ".values())";
        }
        String collectionTargetValue = getInputValue(context, bindingType, "_entry", targetMember, collectionTarget);
        String iteratedParam = "(" + dataSource + " || []).map(_entry => " + collectionTargetValue + ")";
        switch (bindingType) {
            case HEADER:
                return iteratedParam + ".join(', ')";
            case QUERY:
                return iteratedParam;
            default:
                throw new CodegenException("Unexpected collection binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an input value provider for the
     * shape. This redirects to a serialization function for payloads,
     * and fails otherwise.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation input.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the input shape.
     */
    private String getNamedMembersInputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            Shape target
    ) {
        switch (bindingType) {
            case PAYLOAD:
                // Redirect to a serialization function.
                Symbol symbol = context.getSymbolProvider().toSymbol(target);
                return ProtocolGenerator.getSerFunctionName(symbol, context.getProtocolName())
                               + "(" + dataSource + ", context)";
            default:
                throw new CodegenException("Unexpected named member shape binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an input value provider for the
     * shape. This uses the format specified, converting to strings when in a header,
     * label, or query string.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation input.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param member The member that points to the value being provided.
     * @return Returns a value or expression of the input shape.
     */
    private String getTimestampInputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            MemberShape member
    ) {
        HttpBindingIndex httpIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
        Format format;
        switch (bindingType) {
            case HEADER:
                format = httpIndex.determineTimestampFormat(member, bindingType, Format.HTTP_DATE);
                break;
            case LABEL:
                format = httpIndex.determineTimestampFormat(member, bindingType, getDocumentTimestampFormat());
                break;
            case QUERY:
                format = httpIndex.determineTimestampFormat(member, bindingType, Format.DATE_TIME);
                break;
            default:
                throw new CodegenException("Unexpected named member shape binding location `" + bindingType + "`");
        }

        String baseParam = HttpProtocolGeneratorUtils.getTimestampInputParam(context, dataSource, member, format);
        return baseParam + ".toString()";
    }

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
     * headers['foo'] = "This is a custom header";
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
     * Implementations MUST properly fill the body parameter even if no
     * document bindings are present.
     *
     * <p>For example:
     *
     * <pre>{@code
     * const bodyParams: any = {};
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
    protected abstract void serializeInputDocument(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    );

    /**
     * Writes the code needed to serialize the input payload of a request.
     *
     * <p>Implementations of this method are expected to set a value to the
     * {@code body} variable that will be serialized as the request body.
     * This variable will already be defined in scope.
     *
     * <p>For example:
     *
     * <pre>{@code
     * if (input.body !== undefined) {
     *   body = context.base64Encoder(input.body);
     * }
     * }</pre>
     *
     * @param context The generation context.
     * @param operation The operation being generated.
     * @param payloadBinding The payload binding to serialize.
     */
    protected void serializeInputPayload(
            GenerationContext context,
            OperationShape operation,
            HttpBinding payloadBinding
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        String memberName = symbolProvider.toMemberName(payloadBinding.getMember());

        writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
            Shape target = context.getModel().expectShape(payloadBinding.getMember().getTarget());
            MemberShape member = payloadBinding.getMember();
            if (member.getTrait(EventStreamTrait.class).isPresent()) {
                generateEventStreamSerializer(context, member, target);
            } else {
                writer.write("body = $L;", getInputValue(
                        context, Location.PAYLOAD, "input." + memberName, payloadBinding.getMember(), target));
            }
        });
    }

    // Writes a function serializing event stream member.
    private void generateEventStreamSerializer(GenerationContext context, MemberShape member, Shape target) {
        TypeScriptWriter writer = context.getWriter();
        Symbol targetSymbol = context.getSymbolProvider().toSymbol(target);
        StringBuilder serializingFunctionBuilder = new StringBuilder(
                ProtocolGenerator.getSerFunctionName(targetSymbol, context.getProtocolName())).append("_event");
        if (target instanceof StructureShape) {
            // Single-event event stream. Supply event itself instead of event key-value pair to event deserializer
            serializingFunctionBuilder.append("(event[Object.keys(event)[0]], context)");
        } else if (target instanceof UnionShape) {
            // Multi-event event stream. Save the dispatcher
            serializingFunctionBuilder.append("(event, context)");
            this.serializeEventUnions.add(target.asUnionShape().get());
        } else {
            throw new CodegenException(String.format("Unexpected shape type with eventstream trait: `%s`",
                    target.getType()));
        }
        writer.openBlock("body = context.eventStreamMarshaller.serialize(", ");", () -> {
            writer.write("input.$L,", member.getMemberName());
            writer.write("event => $L", serializingFunctionBuilder.toString());
        });
    }

    // Writes a function used to dispatch event to corresponding event serializer if given event stream is
    // a multi-event event stream.
    private void generateSerializingEventUnion(
            GenerationContext context,
            UnionShape events
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(events);
        String protocolName = context.getProtocolName();
        String methodName = ProtocolGenerator.getSerFunctionName(symbol, protocolName) + "_event";
        Model model = context.getModel();
        writer.addImport("Message", "__Message", TypeScriptDependency.AWS_SDK_TYPES.packageName);
        writer.openBlock("const $L = (\n"
                + "  input: any,\n"
                + "  context: __SerdeContext\n"
                + "): __Message => {", "}", methodName, () -> {
            // Visit over the union type, then get the right serialization for the member.
            writer.openBlock("return $T.visit(input, {", "});", symbol, () -> {
                events.getAllMembers().forEach((memberName, memberShape) -> {
                    StructureShape target = model.expectShape(memberShape.getTarget(), StructureShape.class);
                    // Prepare event shapes to generate event serializers.
                    serializeEventShapes.add(target);
                    // Dispatch to special event deserialize function
                    Symbol eventSymbol = symbolProvider.toSymbol(target);
                    String eventSerMethodName =
                            ProtocolGenerator.getSerFunctionName(eventSymbol, protocolName) + "_event";
                    writer.write("$L: value => $L(value, context),", memberName, eventSerMethodName);
                });

                // Handle the unknown property.
                writer.write("_: value => value as any");
            });
        });
    }

    // Writes a function serializing event input into event messages.
    private void generateEventSerializer(GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(event);
        String methodName = ProtocolGenerator.getSerFunctionName(symbol, context.getProtocolName()) + "_event";
        writer.openBlock("const $L = (\n"
                       + "  input: $L,\n"
                       + "  context: __SerdeContext\n"
                       + "): __Message => {", "}", methodName, symbol.getName(), () -> {
            writer.openBlock("const message: __Message = {", "}", () -> {
                writer.openBlock("headers: {", "},", () -> {
                    //fix headers required by event stream
                    writer.write("\":event-type\": { type: \"string\", value: $S },", symbol.getName());
                    writer.write("\":message-type\": { type: \"string\", value: \"event\" }");
                });
                writer.write("body: new Uint8Array()");
            });
            writeEventHeaders(context, event);
            writeEventBody(context, event);
            writer.write("return message;");
        });
    }

    private void writeEventHeaders(GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        List<MemberShape> headerMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventHeaderTrait.class)).collect(Collectors.toList());
        for (MemberShape headerMember : headerMembers) {
            String memberName = headerMember.getMemberName();
            Shape target = model.expectShape(headerMember.getTarget());
            writer.openBlock("if (input.$L) {", "}", memberName, () -> {
                writer.write("message.headers[$S] = { type: $S, value: $L }", memberName,
                        getEventHeaderType(headerMember),
                        getOutputValue(context, Location.HEADER, "input." + memberName, headerMember, target));
            });
        }
    }

    /**
     * The value of event header 'type' property of given shape.
     */
    private String getEventHeaderType(Shape shape) {
        switch (shape.getType()) {
            case BOOLEAN:
            case BYTE:
            case SHORT:
            case INTEGER:
            case LONG:
            case STRING:
            case TIMESTAMP:
                return shape.getType().toString();
            case BLOB:
                return "binary";
            default:
                return "binary";
        }
    }

    private void writeEventBody(GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        List<MemberShape> payloadMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventPayloadTrait.class)).collect(Collectors.toList());
        List<MemberShape> documentMembers = event.getAllMembers().values().stream()
                .filter(member -> !member.hasTrait(EventHeaderTrait.class)
                        && !member.hasTrait(EventPayloadTrait.class))
                .collect(Collectors.toList());
        if (!payloadMembers.isEmpty()) {
            // Write event payload if exists. There is at most 1 payload member.
            MemberShape payloadMember = payloadMembers.get(0);
            String memberName = payloadMember.getMemberName();
            writer.write("message.body = $L || message.body;",
                    getInputValue(context, Location.PAYLOAD, "input." + memberName, payloadMember,
                            model.expectShape(payloadMember.getTarget())));
        } else if (!documentMembers.isEmpty()) {
            // Write event document bindings if exist.
            SymbolProvider symbolProvider = context.getSymbolProvider();
            Symbol symbol = symbolProvider.toSymbol(event);
            // Use normal structure deserializer instead of event deserializer to deserialize document body.
            String serFunctionName = ProtocolGenerator.getDeserFunctionName(symbol, context.getProtocolName());
            writer.write("message.body = $L(input, context);", serFunctionName);
        }
    }

    private void generateOperationDeserializer(
            GenerationContext context,
            OperationShape operation,
            HttpTrait trait
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference responseType = getApplicationProtocol().getResponseType();
        HttpBindingIndex bindingIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
        Model model = context.getModel();
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the response type is imported.
        writer.addUseImports(responseType);
        // e.g., deserializeAws_restJson1_1ExecuteStatement
        String methodName = ProtocolGenerator.getDeserFunctionName(symbol, getName());
        String errorMethodName = methodName + "Error";
        // Add the normalized output type.
        Symbol outputType = symbol.expectProperty("outputType", Symbol.class);
        String contextType = CodegenUtils.getOperationDeserializerContextType(writer, context.getModel(), operation);

        // Handle the general response.
        writer.openBlock("export async function $L(\n"
                       + "  output: $T,\n"
                       + "  context: $L\n"
                       + "): Promise<$T> {", "}", methodName, responseType, contextType, outputType, () -> {
            // Redirect error deserialization to the dispatcher if we receive an error range
            // status code that's not the modeled code (400 or higher). This allows for
            // returning other 2XX or 3XX codes that don't match the defined value.
            writer.openBlock("if (output.statusCode !== $L && output.statusCode >= 400) {", "}", trait.getCode(),
                    () -> writer.write("return $L(output, context);", errorMethodName));

            // Start deserializing the response.
            writer.openBlock("const contents: $T = {", "};", outputType, () -> {
                writer.write("$$metadata: deserializeMetadata(output),");

                // Only set a type and the members if we have output.
                operation.getOutput().ifPresent(outputId -> {
                    writer.write("__type: $S,", outputId.getName());
                    // Set all the members to undefined to meet type constraints.
                    StructureShape target = model.expectShape(outputId).asStructureShape().get();
                    new TreeMap<>(target.getAllMembers())
                            .forEach((memberName, memberShape) -> writer.write(
                                    "$L: undefined,", memberName));
                });
            });
            readHeaders(context, operation, bindingIndex, "output");
            List<HttpBinding> documentBindings = readResponseBody(context, operation, bindingIndex);
            // Track all shapes bound to the document so their deserializers may be generated.
            documentBindings.forEach(binding -> {
                Shape target = model.expectShape(binding.getMember().getTarget());
                deserializingDocumentShapes.add(target);
            });
            writer.write("return Promise.resolve(contents);");
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
        HttpBindingIndex bindingIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
        Model model = context.getModel();
        Symbol errorSymbol = symbolProvider.toSymbol(error);
        String errorDeserMethodName = ProtocolGenerator.getDeserFunctionName(errorSymbol,
                context.getProtocolName()) + "Response";
        String outputName = isErrorCodeInBody ? "parsedOutput" : "output";

        writer.openBlock("const $L = async (\n"
                       + "  $L: any,\n"
                       + "  context: __SerdeContext\n"
                       + "): Promise<$T> => {", "};",
                errorDeserMethodName, outputName, errorSymbol, () -> {
            writer.openBlock("const contents: $T = {", "};", errorSymbol, () -> {
                writer.write("name: $S,", error.getId().getName());
                writer.write("$$fault: $S,", error.getTrait(ErrorTrait.class).get().getValue());
                writer.write("$$metadata: deserializeMetadata($L),", outputName);
                // Set all the members to undefined to meet type constraints.
                new TreeMap<>(error.getAllMembers())
                        .forEach((memberName, memberShape) -> writer.write("$L: undefined,", memberName));
            });

            readHeaders(context, error, bindingIndex, outputName);
            List<HttpBinding> documentBindings = readErrorResponseBody(context, error, bindingIndex);
            // Track all shapes bound to the document so their deserializers may be generated.
            documentBindings.forEach(binding -> {
                Shape target = model.expectShape(binding.getMember().getTarget());
                deserializingDocumentShapes.add(target);
            });
            writer.write("return contents;");
        });

        writer.write("");
    }

    private List<HttpBinding> readErrorResponseBody(
            GenerationContext context,
            Shape error,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        if (isErrorCodeInBody) {
            // Body is already parsed in the error dispatcher, simply assign the body.
            writer.write("const data: any = $L;", getErrorBodyLocation(context, "parsedOutput.body"));
            List<HttpBinding> responseBindings = bindingIndex.getResponseBindings(error, Location.DOCUMENT);
            responseBindings.sort(Comparator.comparing(HttpBinding::getMemberName));
            deserializeOutputDocument(context, error, responseBindings);
            return responseBindings;
        } else {
            // Deserialize response body just like in a normal response.
            return readResponseBody(context, error, bindingIndex);
        }
    }

    private void readHeaders(
            GenerationContext context,
            Shape operationOrError,
            HttpBindingIndex bindingIndex,
            String outputName
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        Model model = context.getModel();
        for (HttpBinding binding : bindingIndex.getResponseBindings(operationOrError, Location.HEADER)) {
            String memberName = symbolProvider.toMemberName(binding.getMember());
            String headerName = binding.getLocationName().toLowerCase(Locale.US);
            writer.openBlock("if ($L.headers[$S] !== undefined) {", "}", outputName, headerName, () -> {
                Shape target = model.expectShape(binding.getMember().getTarget());
                String headerValue = getOutputValue(context, binding.getLocation(),
                        outputName + ".headers['" + headerName + "']", binding.getMember(), target);
                writer.write("contents.$L = $L;", memberName, headerValue);
            });
        }

        // Handle loading up prefix headers.
        List<HttpBinding> prefixHeaderBindings =
                bindingIndex.getResponseBindings(operationOrError, Location.PREFIX_HEADERS);
        if (!prefixHeaderBindings.isEmpty()) {
            // Run through the headers one time, matching any prefix groups.
            writer.openBlock("Object.keys($L.headers).forEach(header => {", "});", outputName, () -> {
                for (HttpBinding binding : prefixHeaderBindings) {
                    // Prepare a grab bag for these headers if necessary
                    String memberName = symbolProvider.toMemberName(binding.getMember());
                    writer.openBlock("if (contents.$L === undefined) {", "}", memberName, () -> {
                        writer.write("contents.$L = {};", memberName);
                    });

                    // Generate a single block for each group of lower-cased prefix headers.
                    String headerLocation = binding.getLocationName().toLowerCase(Locale.US);
                    writer.openBlock("if (header.startsWith($S)) {", "}", headerLocation, () -> {
                        MapShape prefixMap = model.expectShape(binding.getMember().getTarget()).asMapShape().get();
                        Shape target = model.expectShape(prefixMap.getValue().getTarget());
                        String headerValue = getOutputValue(context, binding.getLocation(),
                                outputName + ".headers[header]", binding.getMember(), target);

                        // Extract the non-prefix portion as the key.
                        writer.write("contents.$L[header.substring($L)] = $L;",
                                memberName, headerLocation.length(), headerValue);
                    });
                }
            });
        }
    }

    private List<HttpBinding> readResponseBody(
            GenerationContext context,
            Shape operationOrError,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        List<HttpBinding> documentBindings = bindingIndex.getResponseBindings(operationOrError, Location.DOCUMENT);
        documentBindings.sort(Comparator.comparing(HttpBinding::getMemberName));
        List<HttpBinding> payloadBindings = bindingIndex.getResponseBindings(operationOrError, Location.PAYLOAD);

        if (!documentBindings.isEmpty()) {
            // If the response has document bindings, the body can be parsed to a JavaScript object.
            String bodyLocation = "(await parseBody(output.body, context))";
            // Use the protocol specific error location for retrieving contents.
            if (operationOrError instanceof StructureShape) {
                bodyLocation = getErrorBodyLocation(context, bodyLocation);
            }
            writer.write("const data: any = $L;", bodyLocation);

            deserializeOutputDocument(context, operationOrError, documentBindings);
            return documentBindings;
        }
        if (!payloadBindings.isEmpty()) {
            return readResponsePayload(context, operationOrError, payloadBindings);
        }

        // If there are no payload or document bindings, the body still needs collected so the process can exit.
        writer.write("await collectBody(output.body, context);");
        return ListUtils.of();
    }

    private List<HttpBinding> readResponsePayload(
            GenerationContext context,
            Shape operationOrError,
            List<HttpBinding> payloadBindings
    ) {
        TypeScriptWriter writer = context.getWriter();
        // Detect if operation output or error shape contains a streaming member.
        OperationIndex operationIndex = context.getModel().getKnowledge(OperationIndex.class);
        StructureShape operationOutputOrError = operationOrError.asStructureShape()
                .orElseGet(() -> operationIndex.getOutput(operationOrError).orElse(null));
        boolean hasStreamingComponent = Optional.ofNullable(operationOutputOrError)
                .map(structure -> structure.getAllMembers().values().stream()
                        .anyMatch(memberShape -> memberShape.hasTrait(StreamingTrait.class)))
                .orElse(false);

        // There can only be one payload binding.
        HttpBinding binding = payloadBindings.get(0);
        Shape target = context.getModel().expectShape(binding.getMember().getTarget());
        if (binding.getMember().hasTrait(EventStreamTrait.class)) {
            // If payload is a event stream, return it after calling event stream deser function.
            generateEventStreamDeserializer(context, binding.getMember(), target);
            writer.write("contents.$L = data;", binding.getMemberName());
            //Not to generate non-eventstream payload shape again
            return ListUtils.of();
        } else if (hasStreamingComponent) {
            // If payload is streaming, return raw low-level stream directly.
            writer.write("const data: any = output.body;");
        } else if (target instanceof BlobShape) {
            // If payload is non-streaming blob, only need to collect stream to binary data(Uint8Array).
            writer.write("const data: any = await collectBody(output.body, context);");
        } else if (target instanceof StructureShape || target instanceof UnionShape) {
            // If body is Structure or Union, they we need to parse the string into JavaScript object.
            writer.write("const data: any = await parseBody(output.body, context);");
        } else if (target instanceof StringShape) {
            // If payload is string, we need to collect body and encode binary to string.
            writer.write("const data: any = await collectBodyString(output.body, context);");
        } else {
            throw new CodegenException(String.format("Unexpected shape type bound to payload: `%s`",
                    target.getType()));
        }
        writer.write("contents.$L = $L;", binding.getMemberName(), getOutputValue(context,
                Location.PAYLOAD, "data", binding.getMember(), target));
        return payloadBindings;
    }

    // Writes a function deserializing response payload to stream of event messages
    private void generateEventStreamDeserializer(GenerationContext context, MemberShape member, Shape target) {
        TypeScriptWriter writer = context.getWriter();
        writer.openBlock("const data: any = context.eventStreamMarshaller.deserialize(", ");", () -> {
            writer.write("output.body,");
            writer.openBlock("async event => {", "}", () -> {
                writer.write("const eventName = Object.keys(event)[0];");
                writer.openBlock("const eventHeaders = Object.entries(event[eventName].headers).reduce(", ");", () -> {
                    writer.write(
                            "(accummulator, curr) => {accummulator[curr[0]] = curr[1].value; return accummulator; },");
                    writer.write("{} as {[key: string]: any}");
                });
                writer.openBlock("const eventMessage = {", "};", () -> {
                    writer.write("headers: eventHeaders,");
                    writer.write("body: event[eventName].body");
                });
                writer.openBlock("const parsedEvent = {", "};", () -> {
                    writer.write("[eventName]: eventMessage");
                });
                Symbol targetSymbol = context.getSymbolProvider().toSymbol(target);
                StringBuilder deserFunctionBuilder = new StringBuilder(ProtocolGenerator.getDeserFunctionName(
                        targetSymbol, context.getProtocolName())).append("_event");
                if (target instanceof StructureShape) {
                    // Single-event stream. Save the structure and generate event-specific deser later.
                    this.deserializingEventShapes.add(target.asStructureShape().get());
                    // For single-event stream, supply event message to corresponding event structure deser.
                    deserFunctionBuilder.append("(eventMessage, context)");
                } else if (target instanceof UnionShape) {
                    // Multi-event stream. Save the union and generate dispatcher later.
                    this.deserializeEventUnions.add(target.asUnionShape().get());
                    // For multi-event stream, supply event name to event pairs to the events union deser.
                    deserFunctionBuilder.append("(parsedEvent, context)");
                } else {
                    throw new CodegenException(String.format("Unexpected shape targeted by eventstream: `%s`",
                            target.getType()));
                }
                writer.write("return await $L;", deserFunctionBuilder.toString());

            });
        });
    }

    /**
     * Writes a function used to dispatch event to corresponding event deserializers if given
     * event stream is a multi-event event stream.
     */
    private void generateDeserializingEventUnion(
            GenerationContext context,
            UnionShape events
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(events);
        String protocolName = context.getProtocolName();
        String methodName = ProtocolGenerator.getDeserFunctionName(symbol, protocolName) + "_event";
        Model model = context.getModel();
        writer.openBlock("const $L = async (\n"
                       + "  output: any,\n"
                       + "  context: __SerdeContext\n"
                       + "): Promise<$T> => {", "}", methodName, symbol, () -> {
            events.getAllMembers().forEach((name, member) -> {
                StructureShape target = model.expectShape(member.getTarget(), StructureShape.class);
                // Prepare event for generating event deserializers.
                deserializingEventShapes.add(target);
                writer.openBlock("if (output[$S] !== undefined) {", "}", name, () -> {
                    writer.openBlock("return {", "};", () -> {
                        // Dispatch to special event deserialize function
                        Symbol eventSymbol = symbolProvider.toSymbol(target);
                        String eventDeserMethodName =
                                ProtocolGenerator.getDeserFunctionName(eventSymbol, protocolName) + "_event";
                        writer.write("$1L: await $2L(output[$1S], context)", name, eventDeserMethodName);
                    });
                });
            });
            writer.write("return {$$unknown: output};");
        });
    }

    // Writes a function deserializing event message to event output.
    private void generateEventDeserializer(GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(event);
        String methodName = ProtocolGenerator.getDeserFunctionName(symbol, context.getProtocolName()) + "_event";
        // Handle the general response.
        writer.openBlock("const $L = async (\n"
                       + "  output: any,\n"
                       + "  context: __SerdeContext\n"
                       + "): Promise<$T> => {", "}", methodName, symbol, () -> {
            if (event.hasTrait(ErrorTrait.class)) {
                generateErrorEventDeserializer(context, event);
            } else {
                writer.openBlock("let contents: $L = {", "} as any;", symbol.getName(), () -> {
                    if (!event.getAllMembers().values().isEmpty()) {
                        writer.write("__type: $S,", event.getId().getName());
                    }
                });
                readEventHeaders(context, event);
                readEventBody(context, event);
                writer.write("return contents;");
            }
        });
    }

    // Writes function content that deserialize error event with error deserializer
    private void generateErrorEventDeserializer(GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        // If this is an error event, we need to generate the error deserializer.
        deserializingErrorShapes.add(event);
        Symbol errorSymbol = symbolProvider.toSymbol(event);
        String errorDeserMethodName = ProtocolGenerator.getDeserFunctionName(errorSymbol,
                context.getProtocolName()) + "Response";
        if (isErrorCodeInBody) {
            // If error code is in body, parseBody() won't be called inside error deser. So we parse body here.
            // It's ok to parse body here because body won't be streaming if 'isErrorCodeInBody' is set.
            writer.openBlock("const parsedOutput: any = {", "};",
                    () -> {
                        writer.write("...output,");
                        writer.write("body: await parseBody(output.body, context)");
                    });
            writer.write("return $L(parsedOutput, context);", errorDeserMethodName);
        } else {
            writer.write("return $L(output, context);", errorDeserMethodName);
        }
    }

    // Parse members from event headers.
    private void readEventHeaders(GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        List<MemberShape> headerMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventHeaderTrait.class)).collect(Collectors.toList());
        for (MemberShape headerMember : headerMembers) {
            String memberName = headerMember.getMemberName();
            writer.openBlock("if (output.headers[$S] !== undefined) {", "}", memberName, () -> {
                Shape target = model.expectShape(headerMember.getTarget());
                String headerValue = getOutputValue(context, Location.HEADER,
                        "output.headers['" + memberName + "']", headerMember, target);
                writer.write("contents.$L = $L;", memberName, headerValue);
            });
        }
    }

    private void readEventBody(GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        // Parse members from event payload.
        List<MemberShape> payloadMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventPayloadTrait.class)).collect(Collectors.toList());
        List<MemberShape> documentMembers = event.getAllMembers().values().stream()
                .filter(member -> !member.hasTrait(EventHeaderTrait.class)
                        && !member.hasTrait(EventPayloadTrait.class))
                .collect(Collectors.toList());
        if (!payloadMembers.isEmpty()) {
            //There's only one event payload member
            MemberShape payloadMember = payloadMembers.get(0);
            readEventPayload(context, payloadMember);
        } else if (!documentMembers.isEmpty()) {
            // Parse member from event body using original event structure deser.
            SymbolProvider symbolProvider = context.getSymbolProvider();
            Symbol symbol = symbolProvider.toSymbol(event);
            // If response has document binding, the body can be parsed to JavaScript object.
            writer.write("const data: any = await parseBody(output.body, context);");
            // Deser the event document with the original event(structure) shape deser function
            writer.openBlock("contents = {", "} as any;", () -> {
                writer.write("...contents,");
                writer.write("...$L(data, context)",
                        ProtocolGenerator.getDeserFunctionName(symbol, context.getProtocolName()));
            });
            //need original structure shape deserializer to deserialize event body.
            deserializingDocumentShapes.add(event);
        }
    }

    private void readEventPayload(GenerationContext context, MemberShape payloadMember) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        Shape payloadTarget = model.expectShape(payloadMember.getTarget());
        String memberName = payloadMember.getMemberName();
        if (payloadTarget instanceof BlobShape) {
            // If event payload is a blob, only need to collect stream to binary data(Uint8Array).
            writer.write("contents.$L = output.body;", memberName);
        } else if (payloadTarget instanceof StructureShape || payloadTarget instanceof UnionShape) {
            // If body is Structure or Union, they we need to parse the string into JavaScript object.
            writer.write("contents.$L = await parseBody(output.body, context);", memberName);
        } else if (payloadTarget instanceof StringShape) {
            // If payload is string, we need to collect body and encode binary to string.
            writer.write("contents.$L = await collectBodyString(output.body, context);", memberName);
        } else {
            throw new CodegenException(String.format("Unexpected shape type bound to event payload: `%s`",
                    payloadTarget.getType()));
        }
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
    private String getOutputValue(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            MemberShape member,
            Shape target
    ) {
        if (target instanceof NumberShape) {
            return getNumberOutputParam(bindingType, dataSource, target);
        } else if (target instanceof BooleanShape) {
            return getBooleanOutputParam(bindingType, dataSource);
        } else if (target instanceof StringShape) {
            return HttpProtocolGeneratorUtils.getStringOutputParam(context, target, dataSource);
        } else if (target instanceof DocumentShape) {
            return dataSource;
        } else if (target instanceof TimestampShape) {
            HttpBindingIndex httpIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
            Format format = httpIndex.determineTimestampFormat(member, bindingType, getDocumentTimestampFormat());
            return HttpProtocolGeneratorUtils.getTimestampOutputParam(dataSource, bindingType, member, format);
        } else if (target instanceof BlobShape) {
            return getBlobOutputParam(bindingType, dataSource);
        } else if (target instanceof CollectionShape) {
            return getCollectionOutputParam(context, bindingType, dataSource, (CollectionShape) target);
        } else if (target instanceof StructureShape || target instanceof UnionShape) {
            return getNamedMembersOutputParam(context, bindingType, dataSource, target);
        }

        throw new CodegenException(String.format(
                "Unsupported %s binding of %s to %s in %s using the %s protocol",
                bindingType, member.getMemberName(), target.getType(), member.getContainer(), getName()));
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * boolean. By default, this checks strict equality to 'true'in headers and passes
     * through for documents.
     *
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @return Returns a value or expression of the output boolean.
     */
    private String getBooleanOutputParam(Location bindingType, String dataSource) {
        switch (bindingType) {
            case HEADER:
                return dataSource + " === 'true'";
            default:
                throw new CodegenException("Unexpected blob binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * blob. By default, this base64 decodes content in headers and passes through
     * for payloads.
     *
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @return Returns a value or expression of the output blob.
     */
    private String getBlobOutputParam(Location bindingType, String dataSource) {
        switch (bindingType) {
            case PAYLOAD:
                return dataSource;
            case HEADER:
                // Decode these from base64.
                return "context.base64Decoder(" + dataSource + ")";
            default:
                throw new CodegenException("Unexpected blob binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * collection. By default, this splits a comma separated string in headers.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the output collection.
     */
    private String getCollectionOutputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            CollectionShape target
    ) {
        MemberShape targetMember = target.getMember();
        Shape collectionTarget = context.getModel().expectShape(targetMember.getTarget());
        String collectionTargetValue = getOutputValue(context, bindingType, "_entry.trim()",
                targetMember, collectionTarget);
        switch (bindingType) {
            case HEADER:
                dataSource = "(" + dataSource + " || \"\")";
                // Split these values on commas.
                String outputParam = "" + dataSource + ".split(',')";

                // Headers that have HTTP_DATE formatted timestamps already contain a ","
                // in their formatted entry, so split on every other "," instead.
                if (collectionTarget.isTimestampShape()) {
                    // Check if our member resolves to the HTTP_DATE format.
                    HttpBindingIndex httpIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
                    Format format = httpIndex.determineTimestampFormat(targetMember, bindingType, Format.HTTP_DATE);

                    if (format == Format.HTTP_DATE) {
                        TypeScriptWriter writer = context.getWriter();
                        writer.addImport("splitEvery", "__splitEvery", "@aws-sdk/smithy-client");
                        outputParam = "__splitEvery(" + dataSource + ", ',', 2)";
                    }
                }

                // Iterate over each entry and do deser work.
                outputParam += ".map(_entry => " + collectionTargetValue + ")";

                // Make sets when necessary.
                if (target.isSetShape()) {
                    outputParam = "new Set(" + outputParam + ")";
                }
                return outputParam;
            default:
                throw new CodegenException("Unexpected collection binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * shape. This redirects to a deserialization function for documents and payloads,
     * and fails otherwise.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the output shape.
     */
    private String getNamedMembersOutputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            Shape target
    ) {
        switch (bindingType) {
            case PAYLOAD:
                // Redirect to a deserialization function.
                Symbol symbol = context.getSymbolProvider().toSymbol(target);
                return ProtocolGenerator.getDeserFunctionName(symbol, context.getProtocolName())
                               + "(" + dataSource + ", context)";
            default:
                throw new CodegenException("Unexpected named member shape binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * number. By default, invokes parseInt on byte/short/integer/long types in headers,
     * invokes parseFloat on float/double types in headers, and fails otherwise.
     *
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the output number.
     */
    private String getNumberOutputParam(Location bindingType, String dataSource, Shape target) {
        switch (bindingType) {
            case HEADER:
                if (target instanceof FloatShape || target instanceof DoubleShape) {
                    return "parseFloat(" + dataSource + ")";
                }
                return "parseInt(" + dataSource + ", 10)";
            default:
                throw new CodegenException("Unexpected number binding location `" + bindingType + "`");
        }
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
     * @return A string of the variable containing the error body within the output.
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
     * if (data.fieldList !== undefined) {
     *   contents.fieldList = deserializeAws_restJson1_1FieldList(data.fieldList, context);
     * }
     * }</pre>
     *
     * @param context The generation context.
     * @param operationOrError The operation or error with a document being deserialized.
     * @param documentBindings The bindings to read from the document.
     */
    protected abstract void deserializeOutputDocument(
            GenerationContext context,
            Shape operationOrError,
            List<HttpBinding> documentBindings
    );
}
