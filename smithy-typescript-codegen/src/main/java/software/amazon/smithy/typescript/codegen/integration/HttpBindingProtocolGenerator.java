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

import java.nio.file.Paths;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Consumer;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.knowledge.HttpBinding.Location;
import software.amazon.smithy.model.knowledge.HttpBindingIndex;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.pattern.SmithyPattern.Segment;
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
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.EndpointTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.HostLabelTrait;
import software.amazon.smithy.model.traits.HttpErrorTrait;
import software.amazon.smithy.model.traits.HttpQueryTrait;
import software.amazon.smithy.model.traits.HttpTrait;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.FrameworkErrorModel;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.endpointsV2.RuleSetParameterFinder;
import software.amazon.smithy.typescript.codegen.knowledge.SerdeElisionIndex;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.OptionalUtils;
import software.amazon.smithy.utils.SetUtils;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Abstract implementation useful for all protocols that use HTTP bindings.
 */
@SmithyUnstableApi
public abstract class HttpBindingProtocolGenerator implements ProtocolGenerator {

    private static final Logger LOGGER = Logger.getLogger(HttpBindingProtocolGenerator.class.getName());
    private static final Set<Character> REGEX_CHARS = SetUtils.of('.', '*', '+', '?', '^', '$', '{', '}', '(',
            ')', '|', '[', ']', '\\');
    private static final ApplicationProtocol APPLICATION_PROTOCOL
            = ApplicationProtocol.createDefaultHttpApplicationProtocol();
    private final Set<Shape> serializingDocumentShapes = new TreeSet<>();
    private final Set<Shape> deserializingDocumentShapes = new TreeSet<>();
    private final Set<StructureShape> serializingErrorShapes = new TreeSet<>();
    private final Set<StructureShape> deserializingErrorShapes = new TreeSet<>();
    private final boolean isErrorCodeInBody;
    private final EventStreamGenerator eventStreamGenerator = new EventStreamGenerator();
    private final LinkedHashMap<String, String> headerBuffer = new LinkedHashMap<>();
    private Set<String> contextParamDeduplicationParamControlSet = new HashSet<>();

    /**
     * Creates a Http binding protocol generator.
     *
     * @param isErrorCodeInBody A boolean that indicates if the error code for the implementing protocol is located in
     *   the error response body, meaning this generator will parse the body before attempting to load an error code.
     */
    public HttpBindingProtocolGenerator(boolean isErrorCodeInBody) {
        this.isErrorCodeInBody = isErrorCodeInBody;
    }

    /**
     * Indicate that param names in the set should be de-duplicated when appearing in
     * both contextParams (endpoint ruleset related) and HTTP URI segments / labels.
     */
    public void setContextParamDeduplicationParamControlSet(Set<String> contextParamDeduplicationParamControlSet) {
        this.contextParamDeduplicationParamControlSet = contextParamDeduplicationParamControlSet;
    }

    @Override
    public final ApplicationProtocol getApplicationProtocol() {
        return APPLICATION_PROTOCOL;
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
     * {@link HttpBindingProtocolGenerator#serializeInputDocumentBody}. The {@link DocumentShapeSerVisitor} and
     * {@link DocumentMemberSerVisitor} are provided to reduce the effort of this implementation.
     *
     * @param context The generation context.
     * @param shapes The shapes to generate serialization for.
     */
    protected abstract void generateDocumentBodyShapeSerializers(GenerationContext context, Set<Shape> shapes);

    /**
     * Generates deserialization functions for shapes in the passed set. These functions
     * should return a value that can then be deserialized by the implementation of
     * {@link HttpBindingProtocolGenerator#deserializeInputDocumentBody}. The {@link DocumentShapeDeserVisitor} and
     * {@link DocumentMemberDeserVisitor} are provided to reduce the effort of this implementation.
     *
     * @param context The generation context.
     * @param shapes The shapes to generate deserialization for.
     */
    protected abstract void generateDocumentBodyShapeDeserializers(GenerationContext context, Set<Shape> shapes);

    @Override
    public void generateSharedComponents(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();
        writer.addImport("map", null, TypeScriptDependency.AWS_SMITHY_CLIENT);

        if (context.getSettings().generateClient()) {
            writer.addImport("withBaseException", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
            SymbolReference exception = HttpProtocolGeneratorUtils.getClientBaseException(context);
            writer.write("const throwDefaultError = withBaseException($T);", exception);
        }

        deserializingErrorShapes.forEach(error -> generateErrorDeserializer(context, error));
        serializingErrorShapes.forEach(error -> generateErrorSerializer(context, error));
        ServiceShape service = context.getService();
        eventStreamGenerator.generateEventStreamSerializers(
            context,
            service,
            getDocumentContentType(),
            () -> {
                this.serializeInputEventDocumentPayload(context);
            },
            serializingDocumentShapes
        );
        SerdeElisionIndex serdeElisionIndex = SerdeElisionIndex.of(context.getModel());
        // Error shapes that only referred in the error event of an eventstream
        Set<StructureShape> errorEventShapes = new TreeSet<>();
        eventStreamGenerator.generateEventStreamDeserializers(
            context,
            service,
            errorEventShapes,
            deserializingDocumentShapes,
            isErrorCodeInBody,
            enableSerdeElision(),
            serdeElisionIndex
        );
        errorEventShapes.removeIf(deserializingErrorShapes::contains);
        errorEventShapes.forEach(error -> generateErrorDeserializer(context, error));
        generateDocumentBodyShapeSerializers(context, serializingDocumentShapes);
        generateDocumentBodyShapeDeserializers(context, deserializingDocumentShapes);
        HttpProtocolGeneratorUtils.generateMetadataDeserializer(context, getApplicationProtocol().getResponseType());
        HttpProtocolGeneratorUtils.generateCollectBodyString(context);

        writer.write(
            context.getStringStore().flushVariableDeclarationCode()
        );

        writer.addImport("HttpRequest", "__HttpRequest", TypeScriptDependency.PROTOCOL_HTTP);
        writer.addImport("HttpResponse", "__HttpResponse", TypeScriptDependency.PROTOCOL_HTTP);
    }

    @Override
    public void generateRequestSerializers(GenerationContext context) {
        TopDownIndex topDownIndex = TopDownIndex.of(context.getModel());

        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));
        for (OperationShape operation : containedOperations) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationRequestSerializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol request bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));
        }
    }

    @Override
    public void generateRequestDeserializers(GenerationContext context) {
        TopDownIndex topDownIndex = TopDownIndex.of(context.getModel());

        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));
        for (OperationShape operation : containedOperations) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationRequestDeserializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol request bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));
        }

    }

    @Override
    public void generateResponseSerializers(GenerationContext context) {
        TopDownIndex topDownIndex = TopDownIndex.of(context.getModel());

        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));
        for (OperationShape operation : containedOperations) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationResponseSerializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol response bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));
        }
    }

    @Override
    public void generateFrameworkErrorSerializer(GenerationContext inputContext) {
        final GenerationContext context = inputContext.copy();
        context.setModel(FrameworkErrorModel.INSTANCE.getModel());

        SymbolReference responseType = getApplicationProtocol().getResponseType();
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(context.getModel());
        TypeScriptWriter writer = context.getWriter();

        writer.addImport("SmithyFrameworkException", "__SmithyFrameworkException", TypeScriptDependency.SERVER_COMMON);
        writer.addUseImports(responseType);
        writer.addImport("ServerSerdeContext", null, TypeScriptDependency.SERVER_COMMON);

        writer.openBlock("export const serializeFrameworkException = async(\n"
                + "  input: __SmithyFrameworkException,\n"
                + "  ctx: ServerSerdeContext\n"
                + "): Promise<$T> => {", "}", responseType, () -> {

            writeEmptyEndpoint(context);

            writer.openBlock("switch (input.name) {", "}", () -> {
                for (final Shape shape : new TreeSet<>(context.getModel().getShapesWithTrait(HttpErrorTrait.class))) {
                    StructureShape errorShape = shape.asStructureShape().orElseThrow(IllegalArgumentException::new);
                    writer.openBlock("case $S: {", "}", errorShape.getId().getName(), () -> {
                        generateErrorSerializationImplementation(context, errorShape, responseType, bindingIndex);
                    });
                }
            });
        });
        writer.write("");
    }

    private void generateServiceMux(GenerationContext context) {
        TopDownIndex topDownIndex = TopDownIndex.of(context.getModel());
        TypeScriptWriter writer = context.getWriter();

        writer.addImport("httpbinding", null, TypeScriptDependency.SERVER_COMMON);

        Symbol serviceSymbol = context.getSymbolProvider().toSymbol(context.getService());

        writer.openBlock("const mux = new httpbinding.HttpBindingMux<$S, keyof $T<Context>>([", "]);",
                context.getService().getId().getName(),
                serviceSymbol,
                () -> {
                    for (OperationShape operation : topDownIndex.getContainedOperations(context.getService())) {
                        OptionalUtils.ifPresentOrElse(
                                operation.getTrait(HttpTrait.class),
                                httpTrait -> generateUriSpec(context, operation, httpTrait),
                                () -> LOGGER.warning(String.format(
                                        "Unable to generate %s uri spec for %s because it does not have an "
                                                + "http binding trait", getName(), operation.getId())));

                    }
               }
       );
    }

    private void generateOperationMux(GenerationContext context, OperationShape operation) {
        TypeScriptWriter writer = context.getWriter();

        writer.addImport("httpbinding", null, TypeScriptDependency.SERVER_COMMON);

        writer.openBlock("const mux = new httpbinding.HttpBindingMux<$S, $S>([", "]);",
                context.getService().getId().getName(),
                context.getSymbolProvider().toSymbol(operation).getName(),
                () -> {
                    HttpTrait httpTrait = operation.expectTrait(HttpTrait.class);
                    generateUriSpec(context, operation, httpTrait);
                }
        );
    }

    private void generateUriSpec(GenerationContext context,
                                 OperationShape operation,
                                 HttpTrait httpTrait) {
        TypeScriptWriter writer = context.getWriter();

        String serviceName = context.getService().getId().getName();
        String operationName = context.getSymbolProvider().toSymbol(operation).getName();

        writer.openBlock("new httpbinding.UriSpec<$S, $S>(", "),",
                serviceName,
                operationName,
                () -> {
                    writer.write("'$L',", httpTrait.getMethod());
                    writer.openBlock("[", "],", () -> {
                        for (Segment s : httpTrait.getUri().getSegments()) {
                            if (s.isGreedyLabel()) {
                                writer.write("{ type: 'greedy' },");
                            } else if (s.isLabel()) {
                                writer.write("{ type: 'path' },");
                            } else {
                                writer.write("{ type: 'path_literal', value: $S },", s.getContent());
                            }
                        }
                    });
                    writer.openBlock("[", "],", () -> {
                        for (Map.Entry<String, String> e : httpTrait.getUri().getQueryLiterals().entrySet()) {
                            if (e.getValue() == null) {
                                writer.write("{ type: 'query_literal', key: $S },", e.getKey());
                            } else {
                                writer.write("{ type: 'query_literal', key: $S, value: $S },",
                                        e.getKey(), e.getValue());
                            }
                        }
                        operation.getInput().ifPresent(inputId -> {
                            StructureShape inputShape = context.getModel().expectShape(inputId, StructureShape.class);
                            for (MemberShape ms : inputShape.members()) {
                                if (ms.isRequired() && ms.hasTrait(HttpQueryTrait.class)) {
                                    HttpQueryTrait queryTrait = ms.expectTrait(HttpQueryTrait.class);
                                    writer.write("{ type: 'query', key: $S },", queryTrait.getValue());
                                }
                            }
                        });
                    });
                    writer.writeInline("{ service: $S, operation: $S }", serviceName, operationName);
                });
    }

    @Override
    public void generateServiceHandlerFactory(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();
        TopDownIndex index = TopDownIndex.of(context.getModel());
        Set<OperationShape> operations = index.getContainedOperations(context.getService());
        SymbolProvider symbolProvider = context.getSymbolProvider();

        writer.addRelativeImport("serializeFrameworkException", null,
            Paths.get(".", CodegenUtils.SOURCE_FOLDER, PROTOCOLS_FOLDER,
                ProtocolGenerator.getSanitizedName(getName())));
        writer.addImport("ValidationCustomizer", "__ValidationCustomizer", TypeScriptDependency.SERVER_COMMON);
        writer.addImport("HttpRequest", "__HttpRequest", TypeScriptDependency.PROTOCOL_HTTP);
        writer.addImport("HttpResponse", "__HttpResponse", TypeScriptDependency.PROTOCOL_HTTP);

        Symbol serviceSymbol = symbolProvider.toSymbol(context.getService());
        Symbol handlerSymbol = serviceSymbol.expectProperty("handler", Symbol.class);
        Symbol operationsSymbol = serviceSymbol.expectProperty("operations", Symbol.class);

        if (context.getSettings().isDisableDefaultValidation()) {
            writer.write("export const get$L = <Context>(service: $T<Context>, "
                            + "customizer: __ValidationCustomizer<$T>): "
                            + "__ServiceHandler<Context, __HttpRequest, __HttpResponse> => {",
                    handlerSymbol.getName(), serviceSymbol, operationsSymbol);
        } else {
            writer.write("export const get$L = <Context>(service: $T<Context>): "
                            + "__ServiceHandler<Context, __HttpRequest, __HttpResponse> => {",
                    handlerSymbol.getName(), serviceSymbol);
        }
        writer.indent();

        generateServiceMux(context);
        writer.addImport("ServiceException", "__ServiceException", TypeScriptDependency.SERVER_COMMON);
        writer.openBlock("const serFn: (op: $1T) => __OperationSerializer<$2T<Context>, $1T, __ServiceException> = "
                       + "(op) => {", "};", operationsSymbol, serviceSymbol, () -> {
            writer.openBlock("switch (op) {", "}", () -> {
                operations.stream()
                        .filter(o -> o.getTrait(HttpTrait.class).isPresent())
                        .forEach(writeOperationCase(writer, symbolProvider));
            });
        });

        if (!context.getSettings().isDisableDefaultValidation()) {
            writer.addImport("generateValidationSummary", "__generateValidationSummary",
                TypeScriptDependency.SERVER_COMMON);
            writer.addImport("generateValidationMessage", "__generateValidationMessage",
                TypeScriptDependency.SERVER_COMMON);
            writer.openBlock("const customizer: __ValidationCustomizer<$T> = (ctx, failures) => {", "};",
                operationsSymbol,
                () -> {
                    writeDefaultValidationCustomizer(writer);
                }
            );
        }

        writer.write("return new $T(service, mux, serFn, serializeFrameworkException, customizer);", handlerSymbol);

        writer.dedent().write("}");
    }

    @Override
    public void generateOperationHandlerFactory(GenerationContext context, OperationShape operation) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        writer.addImport("serializeFrameworkException", null,
            Paths.get(".", CodegenUtils.SOURCE_FOLDER, PROTOCOLS_FOLDER,
                ProtocolGenerator.getSanitizedName(getName())).toString());
        writer.addImport("HttpRequest", "__HttpRequest", TypeScriptDependency.PROTOCOL_HTTP);
        writer.addImport("HttpResponse", "__HttpResponse", TypeScriptDependency.PROTOCOL_HTTP);

        final Symbol operationSymbol = symbolProvider.toSymbol(operation);
        final Symbol inputType = operationSymbol.expectProperty("inputType", Symbol.class);
        final Symbol outputType = operationSymbol.expectProperty("outputType", Symbol.class);
        final Symbol serializerType = operationSymbol.expectProperty("serializerType", Symbol.class);
        final Symbol operationHandlerSymbol = operationSymbol.expectProperty("handler", Symbol.class);

        if (context.getSettings().isDisableDefaultValidation()) {
            writer.write("export const get$L = <Context>(operation: __Operation<$T, $T, Context>, "
                       + "customizer: __ValidationCustomizer<$S>): "
                       + "__ServiceHandler<Context, __HttpRequest, __HttpResponse> => {",
                    operationHandlerSymbol.getName(), inputType, outputType, operationSymbol.getName());
        } else {
            writer.write("export const get$L = <Context>(operation: __Operation<$T, $T, Context>): "
                       + "__ServiceHandler<Context, __HttpRequest, __HttpResponse> => {",
                    operationHandlerSymbol.getName(), inputType, outputType);
        }
        writer.indent();

        generateOperationMux(context, operation);

        if (!context.getSettings().isDisableDefaultValidation()) {
            writer.addImport("generateValidationSummary", "__generateValidationSummary",
                TypeScriptDependency.SERVER_COMMON);
            writer.addImport("generateValidationMessage", "__generateValidationMessage",
                TypeScriptDependency.SERVER_COMMON);
            writer.openBlock("const customizer: __ValidationCustomizer<$S> = (ctx, failures) => {", "};",
                operationSymbol.getName(),
                () -> {
                    writeDefaultValidationCustomizer(writer);
                }
            );
        }
        writer.write("return new $T(operation, mux, new $T(), serializeFrameworkException, customizer);",
                operationHandlerSymbol, serializerType);

        writer.dedent().write("}");
    }

    private void writeDefaultValidationCustomizer(TypeScriptWriter writer) {
        writer.openBlock("if (!failures) {", "}", () -> {
            writer.write("return undefined;");
        });

        writer.openBlock("return {", "};", () -> {
            writer.write("name: \"ValidationException\",");
            writer.write("$$fault: \"client\",");
            writer.write("message: __generateValidationSummary(failures),");
            writer.openBlock("fieldList: failures.map(failure => ({", "}))", () -> {
                writer.write("path: failure.path,");
                writer.write("message: __generateValidationMessage(failure)");
            });
        });
    }

    private Consumer<OperationShape> writeOperationCase(
            TypeScriptWriter writer,
            SymbolProvider symbolProvider
    ) {
        return operation -> {
            Symbol operationSymbol = symbolProvider.toSymbol(operation);
            Symbol symbol = operationSymbol.expectProperty("serializerType", Symbol.class);
            writer.write("case $S: return new $T();", operationSymbol.getName(), symbol);
        };
    }

    @Override
    public void generateResponseDeserializers(GenerationContext context) {
        TopDownIndex topDownIndex = TopDownIndex.of(context.getModel());

        Set<OperationShape> containedOperations = new TreeSet<>(
                topDownIndex.getContainedOperations(context.getService()));

        for (OperationShape operation : containedOperations) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationResponseDeserializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol response bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));
        }

        SymbolReference responseType = getApplicationProtocol().getResponseType();
        Set<StructureShape> errorShapes = HttpProtocolGeneratorUtils.generateUnifiedErrorDispatcher(
            context,
            containedOperations.stream().toList(),
            responseType,
            this::writeErrorCodeParser,
            isErrorCodeInBody,
            this::getErrorBodyLocation,
            this::getOperationErrors,
            getErrorAliases(context, containedOperations)
        );
        deserializingErrorShapes.addAll(errorShapes);
    }

    private void generateOperationResponseSerializer(
            GenerationContext context,
            OperationShape operation,
            HttpTrait trait
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference responseType = getApplicationProtocol().getResponseType();
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(context.getModel());
        TypeScriptWriter writer = context.getWriter();

        writer.addUseImports(responseType);
        String methodName = ProtocolGenerator.getGenericSerFunctionName(symbol) + "Response";
        Symbol outputType = symbol.expectProperty("outputType", Symbol.class);
        writer.addImport("ServerSerdeContext", null, TypeScriptDependency.SERVER_COMMON);

        writer.openBlock("export const $L = async(\n"
                + "  input: $T,\n"
                + "  ctx: ServerSerdeContext\n"
                + "): Promise<$T> => {", "}", methodName, outputType, responseType, () -> {
            writeEmptyEndpoint(context, operation);
            writeOperationStatusCode(context, operation, bindingIndex, trait);
            writeResponseHeaders(context, operation, bindingIndex,
                    () -> writeDefaultOutputHeaders(context, operation));

            List<HttpBinding> bodyBindings = writeResponseBody(context, operation, bindingIndex);
            if (!bodyBindings.isEmpty()) {
                // Track all shapes bound to the body so their serializers may be generated.
                bodyBindings.stream()
                        .map(HttpBinding::getMember)
                        .map(member -> context.getModel().expectShape(member.getTarget()))
                        .forEach(serializingDocumentShapes::add);
            }

            calculateContentLength(context);

            writer.openBlock("return new $T({", "});", responseType, () -> {
                writer.write("headers,");
                writer.write("body,");
                writer.write("statusCode,");
            });
        });
        writer.write("");

        serializingErrorShapes.addAll(OperationIndex.of(context.getModel()).getErrors(operation, context.getService()));
    }

    private void calculateContentLength(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();
        writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_BODY_LENGTH_NODE);
        writer.addImport("calculateBodyLength", null, TypeScriptDependency.AWS_SDK_UTIL_BODY_LENGTH_NODE);
        writer.openBlock("if (body && Object.keys(headers).map((str) => str.toLowerCase())"
                + ".indexOf('content-length') === -1) {", "}", () -> {
            writer.write("const length = calculateBodyLength(body);");
            writer.openBlock("if (length !== undefined) {", "}", () -> {
                writer.write("headers = { ...headers, 'content-length': String(length) };");
            });
        });

    }

    private void generateErrorSerializer(GenerationContext context, StructureShape error) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(error);
        SymbolReference responseType = getApplicationProtocol().getResponseType();
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(context.getModel());
        TypeScriptWriter writer = context.getWriter();

        writer.addUseImports(responseType);
        String methodName = ProtocolGenerator.getGenericSerFunctionName(symbol) + "Error";
        writer.addImport("ServerSerdeContext", null, TypeScriptDependency.SERVER_COMMON);

        writer.openBlock("export const $L = async(\n"
                + "  input: $T,\n"
                + "  ctx: ServerSerdeContext\n"
                + "): Promise<$T> => {", "}", methodName, symbol, responseType, () -> {
            writeEmptyEndpoint(context);
            generateErrorSerializationImplementation(context, error, responseType, bindingIndex);
        });
        writer.write("");
    }

    private void generateErrorSerializationImplementation(GenerationContext context,
                                                          StructureShape error,
                                                          SymbolReference responseType,
                                                          HttpBindingIndex bindingIndex) {
        TypeScriptWriter writer = context.getWriter();
        writeErrorStatusCode(context, error);
        writeResponseHeaders(context, error, bindingIndex, () -> writeDefaultErrorHeaders(context, error));

        List<HttpBinding> bodyBindings = writeResponseBody(context, error, bindingIndex);
        if (!bodyBindings.isEmpty()) {
            // Track all shapes bound to the body so their serializers may be generated.
            bodyBindings.stream()
                    .map(HttpBinding::getMember)
                    .map(member -> context.getModel().expectShape(member.getTarget()))
                    .forEach(serializingDocumentShapes::add);
        }

        writer.openBlock("return new $T({", "});", responseType, () -> {
            writer.write("headers,");
            writer.write("body,");
            writer.write("statusCode,");
        });
    }

    private void writeEmptyEndpoint(GenerationContext context) {
        context.getWriter().write("""
            const context: __SerdeContext = {
              ...ctx,
              endpoint: () => Promise.resolve({
                protocol: '',
                hostname: '',
                path: '',
              }),
            };"""
        );
    }

    private void writeEmptyEndpoint(GenerationContext context, OperationShape operation) {
        String contextType = "__SerdeContext";
        boolean hasEventStreamResponse = EventStreamGenerator.hasEventStreamOutput(context, operation);
        if (hasEventStreamResponse) {
            // todo: unsupported SSDK feature.
            contextType += "& any /*event stream context unsupported in ssdk*/";
        }
        context.getWriter().write("""
            const context: $L = {
              ...ctx,
              endpoint: () => Promise.resolve({
                protocol: '',
                hostname: '',
                path: '',
              }),
            };""",
            contextType
        );
    }

    private void generateOperationRequestSerializer(
            GenerationContext context,
            OperationShape operation,
            HttpTrait trait
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference requestType = getApplicationProtocol().getRequestType();
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(context.getModel());
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the request type is imported.
        writer.addUseImports(requestType);
        writer.addTypeImport("Endpoint", "__Endpoint", TypeScriptDependency.SMITHY_TYPES);

        // e.g., se_ES
        String methodName = ProtocolGenerator.getSerFunctionShortName(symbol);
        // e.g., serializeAws_restJson1_1ExecuteStatement
        String methodLongName = ProtocolGenerator.getSerFunctionName(symbol, getName());

        // Add the normalized input type.
        Symbol inputType = symbol.expectProperty("inputType", Symbol.class);
        String contextType = CodegenUtils.getOperationSerializerContextType(writer, context.getModel(), operation);

        writer.writeDocs(methodLongName);
        writer.openBlock("export const $L = async(\n"
                       + "  input: $T,\n"
                       + "  context: $L\n"
                       + "): Promise<$T> => {", "}", methodName, inputType, contextType, requestType, () -> {

            // Get the hostname, path, port, and scheme from client's resolved endpoint.
            // Then construct the request from them. The client's resolved endpoint can
            // be default one or supplied by users.

            writer.addDependency(TypeScriptDependency.SMITHY_CORE);
            writer.addImport("requestBuilder", "rb", TypeScriptDependency.SMITHY_CORE);
            writer.write("const b = rb(input, context);");

            writeRequestHeaders(context, operation, bindingIndex);
            writeResolvedPath(context, operation, bindingIndex, trait);
            boolean hasQueryComponents = writeRequestQueryString(context, operation, bindingIndex, trait);

            List<HttpBinding> bodyBindings = writeRequestBody(context, operation, bindingIndex);
            if (!bodyBindings.isEmpty()) {
                // Track all shapes bound to the body so their serializers may be generated.
                bodyBindings.stream()
                        .map(HttpBinding::getMember)
                        .map(member -> context.getModel().expectShape(member.getTarget()))
                        .filter(shape -> !EventStreamGenerator.isEventStreamShape(shape))
                        .forEach(serializingDocumentShapes::add);
            }

            boolean hasHostPrefix = operation.hasTrait(EndpointTrait.class);
            if (hasHostPrefix) {
                HttpProtocolGeneratorUtils.writeHostPrefix(context, operation);
                writer.write("b.hn(resolvedHostname);");
            }
            writer.write("b.m($S)", trait.getMethod());
            writer.write(".h(headers)");
            if (hasQueryComponents) {
                writer.write(".q(query)");
            }
            // Always set the body,
            writer.write(".b(body);");

            writer.write("return b.build();");
        });

        writer.write("");
    }

    private void writeOperationStatusCode(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex,
            HttpTrait trait
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();

        List<HttpBinding> bindings = bindingIndex.getResponseBindings(operation, Location.RESPONSE_CODE);
        TypeScriptWriter writer = context.getWriter();
        writer.write("let statusCode: number = $L", trait.getCode());
        if (!bindings.isEmpty()) {
            HttpBinding binding = bindings.get(0);
            // This can only be bound to an int so we don't need to do the same sort of complex finagling
            // as we do with other http bindings.
            String bindingMember = "input." + symbolProvider.toMemberName(binding.getMember());
            writer.openBlock("if ($L !== undefined) {", "}", bindingMember, () -> {
                writer.write("statusCode = $L", bindingMember);
            });
        }
    }

    private void writeErrorStatusCode(GenerationContext context, StructureShape error) {
        ErrorTrait trait = error.expectTrait(ErrorTrait.class);
        int code = error.getTrait(HttpErrorTrait.class)
                .map(HttpErrorTrait::getCode)
                .orElse(trait.getDefaultHttpStatusCode());
        context.getWriter().write("const statusCode: number = $L", code);
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

        final Map<String, String> contextParams = new RuleSetParameterFinder(context.getService())
            .getContextParams(context.getModel().getShape(operation.getInputShape()).get());

        // Always write the bound path, but only the actual segments.
        writer.write("b.bp(\"$L\");",
                "/" + trait.getUri().getSegments().stream()
                    .filter(segment -> {
                        String content = segment.getContent();
                        boolean isContextParam = contextParams.containsKey(content);

                        // If the endpoint also contains the uri segment, e.g. Bucket, we
                        // do not want to include it in the operation URI to be resolved.
                        // We use this logic plus a temporary control-list, since it is not yet known
                        // how many services and param names will have this issue.
                        return !(isContextParam
                            && contextParamDeduplicationParamControlSet.contains(content));
                    })
                    .map(Segment::toString)
                    .collect(Collectors.joining("/"))
        );

        // Handle any label bindings.
        if (!labelBindings.isEmpty()) {
            writer.addImport("resolvedPath", "__resolvedPath", TypeScriptDependency.AWS_SMITHY_CLIENT);

            Model model = context.getModel();
            List<Segment> uriLabels = trait.getUri().getLabels();
            for (HttpBinding binding : labelBindings) {
                String memberName = symbolProvider.toMemberName(binding.getMember());
                Shape target = model.expectShape(binding.getMember().getTarget());

                String labelValueProvider = "() => " + getInputValue(
                    context,
                    binding.getLocation(),
                    "input." + memberName + "!",
                    binding.getMember(),
                    target
                );

                // Get the correct label to use.
                Segment uriLabel = uriLabels.stream().filter(s -> s.getContent().equals(memberName)).findFirst().get();
                writer.write("b.p('$L', $L, '$L', $L)",
                    memberName,
                    labelValueProvider,
                    uriLabel.toString(),
                    uriLabel.isGreedyLabel() ? "true" : "false"
                );
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
        List<HttpBinding> queryBindings = bindingIndex.getRequestBindings(operation, Location.QUERY);
        List<HttpBinding> queryParamsBindings = bindingIndex.getRequestBindings(operation, Location.QUERY_PARAMS);

        // Build the initial query bag.
        Map<String, String> queryLiterals = trait.getUri().getQueryLiterals();
        if (!queryLiterals.isEmpty() || !queryBindings.isEmpty() || !queryParamsBindings.isEmpty()) {
            writer.openBlock("const query: any = map({", "});", () -> {
                if (!queryLiterals.isEmpty()) {
                    // Write any query literals present in the uri.
                    queryLiterals.forEach((k, v) -> writer.write("[$L]: [, $S],", context.getStringStore().var(k), v));
                }
                // Handle any additional query params bindings.
                // If query string parameter is also present in httpQuery, it would be overwritten.
                // Serializing HTTP messages https://smithy.io/2.0/spec/http-bindings.html#serializing-http-messages
                if (!queryParamsBindings.isEmpty()) {
                    SymbolProvider symbolProvider = context.getSymbolProvider();
                    String memberName = symbolProvider.toMemberName(queryParamsBindings.get(0).getMember());
                    writer.addImport("convertMap", "convertMap", TypeScriptDependency.AWS_SMITHY_CLIENT);
                    writer.write("...convertMap(input.$L),", memberName);
                }
                // Handle any additional query bindings.
                if (!queryBindings.isEmpty()) {
                    for (HttpBinding binding : queryBindings) {
                        writeRequestQueryParam(context, binding);
                    }
                }
            });
        }

        // Any binding or literal means we generated a query bag.
        return !queryBindings.isEmpty() || !queryLiterals.isEmpty() || !queryParamsBindings.isEmpty();
    }

    private void writeRequestQueryParam(
            GenerationContext context,
            HttpBinding binding
    ) {
        Model model = context.getModel();
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        String memberName = symbolProvider.toMemberName(binding.getMember());
        writer.addImport("extendedEncodeURIComponent", "__extendedEncodeURIComponent",
                TypeScriptDependency.AWS_SMITHY_CLIENT);

        Shape target = model.expectShape(binding.getMember().getTarget());

        boolean isIdempotencyToken = binding.getMember().hasTrait(IdempotencyTokenTrait.class);
        boolean isRequired = binding.getMember().isRequired();

        String idempotencyComponent = "";
        if (isIdempotencyToken && !isRequired) {
            writer
                .addImport("v4", "generateIdempotencyToken", TypeScriptDependency.SMITHY_UUID);
            idempotencyComponent = " ?? generateIdempotencyToken()";
        }
        String memberAssertionComponent = (idempotencyComponent.isEmpty() ? "!" : "");

        String queryValue = getInputValue(
            context,
            binding.getLocation(),
            "input[" + context.getStringStore().var(memberName) + "]" + memberAssertionComponent,
            binding.getMember(),
            target
        );

        String simpleAccessExpression = "input["
            + context.getStringStore().var(memberName)
            + "]" + memberAssertionComponent;

        boolean isSimpleAccessExpression = Objects.equals(
            simpleAccessExpression,
            queryValue
        );

        writer.addImport("expectNonNull", "__expectNonNull", TypeScriptDependency.AWS_SMITHY_CLIENT);

        if (isSimpleAccessExpression) {
            String value = isRequired ? "__expectNonNull($L, `" + memberName + "`)" : "$L";
            // simple undefined check
            writer.write(
                "[$L]: [," + value + idempotencyComponent + "],",
                context.getStringStore().var(binding.getLocationName()),
                queryValue
            );
        } else {
            if (isRequired) {
                // __expectNonNull is immediately invoked and not inside a function.
                writer.write(
                    "[$L]: [__expectNonNull(input.$L, `$L`) != null, () => $L],",
                    context.getStringStore().var(binding.getLocationName()),
                    memberName,
                    memberName,
                    queryValue // no idempotency token default for required members
                );
            } else {
                // undefined check with lazy eval
                writer.write(
                    "[$L]: [() => input.$L !== void 0, () => ($L)$L],",
                    context.getStringStore().var(binding.getLocationName()),
                    memberName,
                    queryValue,
                    idempotencyComponent
                );
            }
        }
    }

    private void flushHeadersBuffer(TypeScriptWriter writer) {
        for (Map.Entry<String, String> entry : headerBuffer.entrySet()) {
            writer.write(entry.getValue());
        }
        headerBuffer.clear();
    }

    private void writeRequestHeaders(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();

        List<HttpBinding> headers = bindingIndex.getRequestBindings(operation, Location.HEADER);
        List<HttpBinding> prefixHeaders = bindingIndex.getRequestBindings(operation, Location.PREFIX_HEADERS);
        boolean inputPresent = operation.getInput().isPresent();

        int normalHeaderCount = headers.size();
        int prefixHeaderCount = prefixHeaders.size();

        String opening;
        String closing;
        if (normalHeaderCount + prefixHeaderCount == 0) {
            opening = "const headers: any = {";
            closing = "};";
        } else {
            writer.addImport("isSerializableHeaderValue", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
            opening = normalHeaderCount > 0
                ? "const headers: any = map({}, isSerializableHeaderValue, {"
                : "const headers: any = map({";
            closing = "});";
        }

        // Headers are always present either from the default document or the payload.
        writer.write(opening);
        writer.indent();
        // Only set the content type if one can be determined.
        writeContentTypeHeader(context, operation, true);
        writeDefaultInputHeaders(context, operation);
        if (inputPresent) {
            // Handle assembling prefix headers.
            for (HttpBinding binding : prefixHeaders) {
                writePrefixHeaders(context, binding);
            }
        }

        if (inputPresent) {
            for (HttpBinding binding : headers) {
                writeNormalHeader(context, binding);
            }
        }

        flushHeadersBuffer(writer);
        writer.dedent();
        writer.write(closing);
    }

    private void writeNormalHeader(GenerationContext context, HttpBinding binding) {
        String memberLocation = "input["
            + context.getStringStore().var(context.getSymbolProvider().toMemberName(binding.getMember()))
            + "]";
        Shape target = context.getModel().expectShape(binding.getMember().getTarget());

        String headerKey = binding.getLocationName().toLowerCase(Locale.US);
        String headerValue = getInputValue(
            context,
            binding.getLocation(),
            memberLocation + "!",
            binding.getMember(),
            target
        );

        boolean headerAssertion = headerValue.endsWith("!");
        String headerBaseValue = (headerAssertion
            ? headerValue.substring(0, headerValue.length() - 1)
            : headerValue);
        boolean isIdempotencyToken = binding.getMember().hasTrait(IdempotencyTokenTrait.class);

        if (!Objects.equals(memberLocation + "!", headerValue)) {
            String defaultValue = "";
            if (headerBuffer.containsKey(headerKey)) {
                String s = headerBuffer.get(headerKey);
                defaultValue = " || " + s.substring(s.indexOf(": ") + 2, s.length() - 1);
            } else if (isIdempotencyToken) {
                context.getWriter()
                    .addImport("v4", "generateIdempotencyToken", TypeScriptDependency.SMITHY_UUID);
                defaultValue = " ?? generateIdempotencyToken()";
            }

            String headerValueExpression = headerAssertion && !defaultValue.isEmpty()
                ? headerBaseValue + defaultValue
                : headerValue + defaultValue;

            // evaluated value has a function or method call attached
            context.getWriter()
                .addImport("isSerializableHeaderValue", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
            headerBuffer.put(headerKey, String.format(
                "[%s]: [() => isSerializableHeaderValue(%s), () => %s],",
                context.getStringStore().var(headerKey),
                memberLocation + defaultValue,
                headerValueExpression
            ));
        } else {
            String constructedHeaderValue = (headerAssertion
                ? headerBaseValue
                : headerValue);
            if (headerBuffer.containsKey(headerKey)) {
                String s = headerBuffer.get(headerKey);
                constructedHeaderValue += " || " + s.substring(s.indexOf(": ") + 2, s.length() - 1);
            } else if (isIdempotencyToken) {
                context.getWriter()
                    .addImport("v4", "generateIdempotencyToken", TypeScriptDependency.SMITHY_UUID);
                constructedHeaderValue += " ?? generateIdempotencyToken()";
            } else {
                constructedHeaderValue = headerValue;
            }
            headerBuffer.put(headerKey, String.format(
                "[%s]: %s,",
                context.getStringStore().var(headerKey),
                constructedHeaderValue
            ));
        }
    }

    private void writePrefixHeaders(GenerationContext context, HttpBinding binding) {
        Model model = context.getModel();
        TypeScriptWriter writer = context.getWriter();
        String memberLocation = "input." + context.getSymbolProvider().toMemberName(binding.getMember());
        MapShape prefixMap = model.expectShape(binding.getMember().getTarget()).asMapShape().get();
        Shape target = model.expectShape(prefixMap.getValue().getTarget());
        // Iterate through each entry in the member.
        writer.openBlock("...($1L !== undefined) && Object.keys($1L).reduce(", "),", memberLocation,
            () -> {
                writer.openBlock("(acc: any, suffix: string) => {", "}, {}",
                    () -> {
                        // Use a ! since we already validated the input member is defined above.
                        String headerValue = getInputValue(context, binding.getLocation(),
                                memberLocation + "![suffix]", binding.getMember(), target);
                        // Append the prefix to key.
                        writer.write("acc[`$L$${suffix.toLowerCase()}`] = $L;",
                                binding.getLocationName().toLowerCase(Locale.US), headerValue);
                        writer.write("return acc;");
                    });
            }
        );
    }

    private void writeResponseHeaders(
            GenerationContext context,
            Shape operationOrError,
            HttpBindingIndex bindingIndex,
            Runnable injectExtraHeaders
    ) {
        TypeScriptWriter writer = context.getWriter();

        // Headers are always present either from the default document or the payload.
        writer.addImport("isSerializableHeaderValue", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
        writer.openBlock("let headers: any = map({}, isSerializableHeaderValue, {", "});", () -> {
            writeContentTypeHeader(context, operationOrError, false);
            injectExtraHeaders.run();

            // Handle assembling prefix headers.
            for (HttpBinding binding : bindingIndex.getResponseBindings(operationOrError, Location.PREFIX_HEADERS)) {
                writePrefixHeaders(context, binding);
            }

            for (HttpBinding binding : bindingIndex.getResponseBindings(operationOrError, Location.HEADER)) {
                writeNormalHeader(context, binding);
            }

            flushHeadersBuffer(writer);
        });
    }

    private void writeContentTypeHeader(GenerationContext context, Shape operationOrError, boolean isInput) {
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(context.getModel());
        Optional<String> optionalContentType;
        if (isInput) {
            optionalContentType = bindingIndex.determineRequestContentType(operationOrError, getDocumentContentType());
        } else {
            optionalContentType = bindingIndex.determineResponseContentType(operationOrError, getDocumentContentType());
        }
        // If we need to write a default body then it needs a content type.
        if (optionalContentType.isEmpty() && shouldWriteDefaultBody(context, operationOrError, isInput)) {
            optionalContentType = Optional.of(getDocumentContentType());
        }
        optionalContentType.ifPresent(contentType -> {
            // context.getWriter().write("'content-type': $S,", contentType)
            headerBuffer.put("content-type",
                "'content-type': '" + contentType + "',"
            );
        });
    }

    private List<HttpBinding> writeRequestBody(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        List<HttpBinding> payloadBindings = bindingIndex.getRequestBindings(operation, Location.PAYLOAD);
        List<HttpBinding> documentBindings = bindingIndex.getRequestBindings(operation, Location.DOCUMENT);
        boolean shouldWriteDefaultBody = shouldWriteDefaultInputBody(context, operation);
        return writeBody(context, operation, payloadBindings, documentBindings, shouldWriteDefaultBody, true);
    }

    private List<HttpBinding> writeResponseBody(
            GenerationContext context,
            Shape operationOrError,
            HttpBindingIndex bindingIndex
    ) {
        // We just make one up here since it's not actually used by consumers.
        List<HttpBinding> payloadBindings = bindingIndex.getResponseBindings(operationOrError, Location.PAYLOAD);
        List<HttpBinding> documentBindings = bindingIndex.getResponseBindings(operationOrError, Location.DOCUMENT);
        boolean shouldWriteDefaultBody = operationOrError.asOperationShape()
                .map(operation -> shouldWriteDefaultOutputBody(context, operation))
                .orElseGet(() -> shouldWriteDefaultErrorBody(context, operationOrError.asStructureShape().get()));
        return writeBody(context, operationOrError, payloadBindings, documentBindings, shouldWriteDefaultBody, false);
    }

    private boolean shouldWriteDefaultBody(GenerationContext context, Shape operationOrError, boolean isInput) {
        if (isInput) {
            return shouldWriteDefaultInputBody(context, operationOrError.asOperationShape().get());
        } else if (operationOrError.isOperationShape()) {
            return shouldWriteDefaultOutputBody(context, operationOrError.asOperationShape().get());
        } else {
            return shouldWriteDefaultErrorBody(context, operationOrError.asStructureShape().get());
        }
    }

    /**
     * Given a context and operation, should a default input body be written. By default, a body
     * will be written if and only if there are payload members bound to the input.
     *
     * @param context The generation context.
     * @param operation The operation whose input is being serialized.
     *
     * @return True if a default body should be generated.
     */
    protected boolean shouldWriteDefaultInputBody(GenerationContext context, OperationShape operation) {
        return HttpBindingIndex.of(context.getModel()).hasRequestBody(operation);
    }

    /**
     * Given a context and operation, should a default output body be written. By default no body will be written
     * if there are no members bound to the output.
     *
     * @param context The generation context.
     * @param operation The operation whose output is being serialized.
     *
     * @return True if a default body should be generated.
     */
    protected boolean shouldWriteDefaultOutputBody(GenerationContext context, OperationShape operation) {
        return HttpBindingIndex.of(context.getModel()).getResponseBindings(operation).isEmpty();
    }

    /**
     * Given a context and error, should a default body be written. By default no body will be written
     * if there are no members bound to the error.
     *
     * @param context The generation context.
     * @param error The error being serialized.
     *
     * @return True if a default body should be generated.
     */
    protected boolean shouldWriteDefaultErrorBody(GenerationContext context, StructureShape error) {
        return HttpBindingIndex.of(context.getModel()).getResponseBindings(error).isEmpty();
    }

    private List<HttpBinding> writeBody(
            GenerationContext context,
            Shape operationOrError,
            List<HttpBinding> payloadBindings,
            List<HttpBinding> documentBindings,
            boolean shouldWriteDefaultBody,
            boolean isInput
    ) {
        TypeScriptWriter writer = context.getWriter();
        // Write the default `body` property.
        writer.write("let body: any;");

        // Handle a payload binding explicitly.
        if (!payloadBindings.isEmpty()) {
            // There can only be one payload binding.
            HttpBinding payloadBinding = payloadBindings.get(0);
            if (isInput) {
                serializeInputPayload(context, operationOrError.asOperationShape().get(), payloadBinding);
            } else if (operationOrError.isOperationShape()) {
                serializeOutputPayload(context, operationOrError.asOperationShape().get(), payloadBinding);
            } else {
                serializeErrorPayload(context, operationOrError.asStructureShape().get(), payloadBinding);
            }
            return payloadBindings;
        }

        // If we have document bindings or need a defaulted request body,
        // use the input document serialization.
        if (!documentBindings.isEmpty() || shouldWriteDefaultBody) {
            documentBindings.sort(Comparator.comparing(HttpBinding::getMemberName));
            if (isInput) {
                serializeInputDocumentBody(context, operationOrError.asOperationShape().get(), documentBindings);
            } else if (operationOrError.isOperationShape()) {
                serializeOutputDocumentBody(context, operationOrError.asOperationShape().get(), documentBindings);
            } else {
                serializeErrorDocumentBody(context, operationOrError.asStructureShape().get(), documentBindings);
            }
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
            return getStringInputParam(context, bindingType, dataSource, target);
        } else if (target instanceof FloatShape || target instanceof DoubleShape) {
            // Handle decimal numbers needing to have .0 in their value when whole numbers.
            return "((" + dataSource + " % 1 == 0) ? " + dataSource + " + \".0\" : " + dataSource + ".toString())";
        } else if (target instanceof BooleanShape || target instanceof NumberShape) {
            return dataSource + ".toString()";
        } else if (target instanceof TimestampShape) {
            return getTimestampInputParam(context, bindingType, dataSource, member);
        } else if (target instanceof DocumentShape) {
            return dataSource;
        } else if (target instanceof BlobShape) {
            return getBlobInputParam(bindingType, dataSource);
        } else if (target instanceof CollectionShape) {
            return getCollectionInputParam(context, bindingType, dataSource, (CollectionShape) target);
        } else if (target instanceof StructureShape || target instanceof UnionShape) {
            return getNamedMembersInputParam(context, bindingType, dataSource, target);
        } else if (target instanceof MapShape) {
            return getMapInputParam(context, bindingType, dataSource, (MapShape) target);
        }

        throw new CodegenException(String.format(
                "Unsupported %s binding of %s to %s in %s using the %s protocol",
                bindingType, member.getMemberName(), target.getType(), member.getContainer(), getName()));
    }

    /**
     * Given context and a source of data, generate an input value provider for the
     * string. By default, this base64 encodes content in headers if there is a
     * mediaType applied to the string, and passes through for all other cases.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation input.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the input string.
     */
    private String getStringInputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            Shape target
    ) {
        String baseParam = HttpProtocolGeneratorUtils.getStringInputParam(context, target, dataSource);
        switch (bindingType) {
            case HEADER:
                // Encode these to base64 if a MediaType is present.
                if (target.hasTrait(MediaTypeTrait.ID)) {
                    return "context.base64Encoder(Buffer.from(" + baseParam + "))";
                }
            default:
                return baseParam;
        }
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
        String iteratedParam;
        if (collectionTargetValue.equals("_entry")) {
            iteratedParam = "(" + dataSource + " || [])";
        } else {
            iteratedParam = "(" + dataSource + " || []).map(_entry => " + collectionTargetValue + " as any)";
        }

        switch (bindingType) {
            case HEADER:
                if (collectionTarget.isStringShape()) {
                    context.getWriter().addImport(
                        "quoteHeader", "__quoteHeader", TypeScriptDependency.AWS_SMITHY_CLIENT);
                    return iteratedParam + ".map(__quoteHeader).join(', ')";
                }
                return iteratedParam + ".join(', ')";
            case QUERY:
            case QUERY_PARAMS:
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
                Symbol symbol = context.getSymbolProvider().toSymbol(target);

                boolean mayElideInput = SerdeElisionIndex.of(context.getModel()).mayElide(target)
                        && (enableSerdeElision() && !context.getSettings().generateServerSdk());

                if (mayElideInput) {
                    context.getWriter().addImport("_json", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
                    return "_json(" + dataSource + ")";
                }

                return ProtocolGenerator.getSerFunctionShortName(symbol)
                        + "(" + dataSource + ", context)";
            default:
                throw new CodegenException("Unexpected named member shape binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an input value provider for the
     * map.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation input.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the input collection.
     */
    private String getMapInputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            MapShape target
    ) {
        Model model = context.getModel();
        MemberShape mapMember = target.getValue();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        String valueString = getInputValue(context, bindingType, "value", mapMember,
                model.expectShape(mapMember.getTarget()));
        return "Object.entries(" + dataSource + " || {}).reduce("
            + "(acc: any, [key, value]: [string, " + symbolProvider.toSymbol(mapMember) + "]) => {"
            +   "acc[key] = " + valueString + ";"
            +   "return acc;"
            + "}, {})";
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
        HttpBindingIndex httpIndex = HttpBindingIndex.of(context.getModel());
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
     * Writes any additional HTTP input headers required by the protocol implementation.
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
     * @param operation The operation whose input is being generated.
     */
    protected void writeDefaultInputHeaders(GenerationContext context, OperationShape operation) {
    }

    /**
     * Writes any additional HTTP output headers required by the protocol implementation.
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
     * @param operation The operation whose output is being generated.
     */
    protected void writeDefaultOutputHeaders(GenerationContext context, OperationShape operation) {
    }

    /**
     * Writes any additional HTTP error headers required by the protocol implementation.
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
     * @param error The error which is being generated.
     */
    protected void writeDefaultErrorHeaders(GenerationContext context, StructureShape error) {
    }

    /**
     * Writes the code needed to serialize a protocol input document.
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
     * @param context The generation context.
     * @param operation The operation whose input is being generated.
     * @param documentBindings The bindings to place in the document.
     */
    protected abstract void serializeInputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    );

    /**
     * Writes the code needed to serialize an event payload as a protocol-specific document.
     *
     * <p>Implementations of this method are expected to set a value to the instantiated ${@code body} variable.
     * The value set is expected to be a JavaScript ${@code Uint8Array} type and is to be encoded as the
     * event payload.
     *
     * <p>Three parameters will be available in scope:
     * <ul>
     *   <li>{@code body}: The serialized event payload object that needs to be transformed to binary data</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>For example:
     *
     * <pre>{@code
     * body = context.utf8Decoder(JSON.stringify(body));
     * }</pre>
     * @param context The generation context.
     */
    protected abstract void serializeInputEventDocumentPayload(GenerationContext context);

    /**
     * Writes the code needed to serialize a protocol output document.
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
     * @param context The generation context.
     * @param operation The operation whose output is being generated.
     * @param documentBindings The bindings to place in the document.
     */
    protected abstract void serializeOutputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    );

    /**
     * Writes the code needed to serialize a protocol error document.
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
     * @param context The generation context.
     * @param error The error that is being generated.
     * @param documentBindings The bindings to place in the document.
     */
    protected abstract void serializeErrorDocumentBody(
            GenerationContext context,
            StructureShape error,
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
     * @param context The generation context.
     * @param operation The operation whose input is being generated.
     * @param payloadBinding The payload binding to serialize.
     */
    protected void serializeInputPayload(
            GenerationContext context,
            OperationShape operation,
            HttpBinding payloadBinding
    ) {
        genericSerializePayload(context, payloadBinding);
    }

    /**
     * Writes the code needed to serialize the output payload of a response.
     *
     * <p>Implementations of this method are expected to set a value to the
     * {@code body} variable that will be serialized as the response body.
     * This variable will already be defined in scope.
     *
     * <p>For example:
     *
     * <pre>{@code
     * if (input.body !== undefined) {
     *   body = context.base64Encoder(input.body);
     * }
     * }</pre>
     * @param context The generation context.
     * @param operation The operation whose output is being generated.
     * @param payloadBinding The payload binding to serialize.
     */
    protected void serializeOutputPayload(
            GenerationContext context,
            OperationShape operation,
            HttpBinding payloadBinding
    ) {
        genericSerializePayload(context, payloadBinding);
    }

    /**
     * Writes the code needed to serialize the error payload of a response.
     *
     * <p>Implementations of this method are expected to set a value to the
     * {@code body} variable that will be serialized as the response body.
     * This variable will already be defined in scope.
     *
     * <p>For example:
     *
     * <pre>{@code
     * if (input.body !== undefined) {
     *   body = context.base64Encoder(input.body);
     * }
     * }</pre>
     * @param context The generation context.
     * @param error The error being generated.
     * @param payloadBinding The payload binding to serialize.
     */
    protected void serializeErrorPayload(
            GenerationContext context,
            StructureShape error,
            HttpBinding payloadBinding
    ) {
        genericSerializePayload(context, payloadBinding);
    }

    private void genericSerializePayload(GenerationContext context, HttpBinding payloadBinding) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        String memberName = symbolProvider.toMemberName(payloadBinding.getMember());

        writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
            Shape target = context.getModel().expectShape(payloadBinding.getMember().getTarget());

            // Because documents can be set to a null value, handle setting that as the body
            // instead of using toString, as `null.toString()` will fail.
            if (target.isDocumentShape()) {
                writer.openBlock("if (input.$L === null) {", "} else {", memberName,
                        () -> writer.write("body = \"null\";"));
                writer.indent();

            }
            writer.write("body = $L;", getInputValue(
                    context, Location.PAYLOAD, "input." + memberName, payloadBinding.getMember(), target));
            if (target.isDocumentShape()) {
                writer.dedent();
                writer.write("}");
            }
        });
    }

    private void generateOperationRequestDeserializer(
            GenerationContext context,
            OperationShape operation,
            HttpTrait trait
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference requestType = getApplicationProtocol().getRequestType();
        Model model = context.getModel();
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(model);
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the request type is imported.
        writer.addUseImports(requestType);
        writer.addTypeImport("Endpoint", "__Endpoint", TypeScriptDependency.SMITHY_TYPES);
        String methodName = ProtocolGenerator.getGenericDeserFunctionName(symbol) + "Request";
        // Add the normalized input type.
        Symbol inputType = symbol.expectProperty("inputType", Symbol.class);
        String contextType = CodegenUtils.getOperationSerializerContextType(writer, context.getModel(), operation);

        writer.openBlock("export const $L = async(\n"
                + "  output: $T,\n"
                + "  context: $L\n"
                + "): Promise<$T> => {", "}", methodName, requestType, contextType, inputType, () -> {
            handleContentType(context, operation, bindingIndex);
            handleAccept(context, operation, bindingIndex);
            // Start deserializing the response.
            writer.openBlock("const contents: any = map({", "});", () -> {
                readRequestHeaders(context, operation, bindingIndex, "output");
            });
            readQueryString(context, operation, bindingIndex);
            readPath(context, operation, bindingIndex, trait);
            readHost(context, operation);
            List<HttpBinding> documentBindings = readRequestBody(context, operation, bindingIndex);
            // Track all shapes bound to the document so their deserializers may be generated.
            documentBindings.forEach(binding -> {
                Shape target = model.expectShape(binding.getMember().getTarget());
                deserializingDocumentShapes.add(target);
            });
            writer.write("return contents;");
        });
        writer.write("");
    }

    /**
     * Writes out handling for the content-type header. The following rules apply:
     *
     *  - The content-type header may always be omitted.
     *  - If the input shape has a member with the httpPayload trait then the following apply:
     *      - If the target is a shape with the mediaType trait, the value of the content-type header must
     *        match if present.
     *      - If the target is a blob shape without a media type, the content-type header may have any value.
     *      - Otherwise the content-type header must match the implied content type of the target shape, e.g.
     *        text/plain for a string.
     *  - If the input shape has no members with the httpPayload trait, but does have members bound to
     *    the document, the content-type header must match the default protocol document content type if
     *    present.
     *  - If the input shape has no members bound to the payload / document, the content-type header
     *    must not be set.
     */
    private void handleContentType(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        // Don't enforce any restrictions on a blob bodies if they don't have a
        // modeled media type. There are plenty of valid reasons for wanting to
        // accept a range of media types in this case, like supporting multiple
        // image/video formats.
        if (bodyIsBlobWithoutMediaType(context, bindingIndex.getRequestBindings(operation).values())) {
            return;
        }

        TypeScriptWriter writer = context.getWriter();
        writer.addImport("UnsupportedMediaTypeException",
                "__UnsupportedMediaTypeException",
                TypeScriptDependency.SERVER_COMMON);
        Optional<String> optionalContentType = bindingIndex.determineRequestContentType(
                operation, getDocumentContentType());
        writer.write("const contentTypeHeaderKey: string | undefined = Object.keys(output.headers)"
                + ".find(key => key.toLowerCase() === 'content-type');");
        writer.openBlock("if (contentTypeHeaderKey != null) {", "};", () -> {
            writer.write("const contentType = output.headers[contentTypeHeaderKey];");
            if (optionalContentType.isPresent() || operation.getInput().isPresent()) {
                String contentType = optionalContentType.orElse(getDocumentContentType());
                // If the operation accepts a content type, it must be either unset or the expected value.
                writer.openBlock("if (contentType !== undefined && contentType !== $S) {", "};", contentType, () -> {
                    writer.write("throw new __UnsupportedMediaTypeException();");
                });
            } else {
                // If the operation doesn't accept a content type, it must not be set.
                writer.openBlock("if (contentType !== undefined) {", "};", () -> {
                    writer.write("throw new __UnsupportedMediaTypeException();");
                });
            }
        });
    }

    /**
     * Writes out handling for the accept header. The following rules apply:
     *
     *  - The accept header may always be omitted.
     *  - If the output shape has a member with the httpPayload trait then the following apply:
     *      - If the target is a shape with the mediaType trait, the value of the accept header must
     *        match if present.
     *      - If the target is a blob shape without a media type, the accept header may have any value.
     *      - Otherwise the accept header must match the implied content type of the target shape, e.g.
     *        text/plain for a string.
     *  - If the output shape has no members with the httpPayload trait, the accept header must match
     *    the default protocol document content type if present.
     *
     *  Note: matching is performed based on the rules in https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2
     *        and any match is considered acceptable, regardless of the supplied accept-params.
     */
    private void handleAccept(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        // Don't enforce any restrictions on a blob bodies if they don't have a
        // modeled media type. There are plenty of valid reasons for wanting to
        // accept a range of media types in this case, like supporting multiple
        // image/video formats.
        if (bodyIsBlobWithoutMediaType(context, bindingIndex.getResponseBindings(operation).values())) {
            return;
        }

        TypeScriptWriter writer = context.getWriter();
        Optional<String> optionalContentType = bindingIndex.determineResponseContentType(
                operation, getDocumentContentType());
        writer.addImport("NotAcceptableException",
                "__NotAcceptableException",
                TypeScriptDependency.SERVER_COMMON);
        writer.addImport("acceptMatches", "__acceptMatches", TypeScriptDependency.SERVER_COMMON);
        writer.write("const acceptHeaderKey: string | undefined = Object.keys(output.headers)"
                + ".find(key => key.toLowerCase() === 'accept');");
        writer.openBlock("if (acceptHeaderKey != null) {", "};", () -> {
            writer.write("const accept = output.headers[acceptHeaderKey];");
            String contentType = optionalContentType.orElse(getDocumentContentType());
            // Validate that the content type matches the protocol default, or what's modeled if there's
            // a modeled type.
            writer.openBlock("if (!__acceptMatches(accept, $S)) {", "};", contentType,
                    () -> writer.write("throw new __NotAcceptableException();"));
        });
    }

    private boolean bodyIsBlobWithoutMediaType(
            GenerationContext context,
            Collection<HttpBinding> bindings
    ) {
        for (HttpBinding binding : bindings)  {
            if (binding.getLocation() == Location.PAYLOAD) {
                Shape target = context.getModel().expectShape(binding.getMember().getTarget());
                return !target.hasTrait(MediaTypeTrait.class) && target.isBlobShape();
            }
        }
        return false;
    }

    private void readQueryString(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        List<HttpBinding> directQueryBindings = bindingIndex.getRequestBindings(operation, Location.QUERY);
        List<HttpBinding> mappedQueryBindings = bindingIndex.getRequestBindings(operation, Location.QUERY_PARAMS);
        if (directQueryBindings.isEmpty() && mappedQueryBindings.isEmpty()) {
            return;
        }
        writer.write("const query = output.query");
        writer.openBlock("if (query != null) {", "}", () -> {
            readDirectQueryBindings(context, directQueryBindings);
            if (!mappedQueryBindings.isEmpty()) {
                // There can only ever be one of these bindings on a given operation.
                readMappedQueryBindings(context, mappedQueryBindings.get(0));
            }
        });
    }

    private void readDirectQueryBindings(GenerationContext context, List<HttpBinding> directQueryBindings) {
        TypeScriptWriter writer = context.getWriter();
        for (HttpBinding binding : directQueryBindings) {
            String memberName = context.getSymbolProvider().toMemberName(binding.getMember());
            writer.openBlock("if (query[$S] !== undefined) {", "}", binding.getLocationName(), () -> {
                Shape target = context.getModel().expectShape(binding.getMember().getTarget());
                if (target instanceof CollectionShape) {
                    writer.write("const queryValue = Array.isArray(query[$1S]) ? (query[$1S] as string[])"
                            + " : [query[$1S] as string];", binding.getLocationName());
                } else {
                    writer.addImport("SerializationException",
                            "__SerializationException",
                            TypeScriptDependency.SERVER_COMMON);
                    writer.write("let queryValue: string;");
                    writer.openBlock("if (Array.isArray(query[$S])) {", "}",
                        binding.getLocationName(),
                        () -> {
                            writer.openBlock("if (query[$S].length === 1) {", "}",
                                binding.getLocationName(),
                                () -> {
                                    writer.write("queryValue = query[$S][0];", binding.getLocationName());
                                }
                            );
                            writer.openBlock("else {", "}", () -> {
                                writer.write("throw new __SerializationException();");
                            });
                        });
                    writer.openBlock("else {", "}", () -> {
                        writer.write("queryValue = query[$S] as string;", binding.getLocationName());
                    });
                }
                String queryValue = getOutputValue(context, binding.getLocation(), "queryValue",
                        binding.getMember(), target);
                writer.write("contents.$L = $L;", memberName, queryValue);
            });
        }
    }

    private void readMappedQueryBindings(GenerationContext context, HttpBinding mappedBinding) {
        TypeScriptWriter writer = context.getWriter();
        MapShape target = context.getModel()
                .expectShape(mappedBinding.getMember().getTarget()).asMapShape().get();
        Shape valueShape = context.getModel().expectShape(target.getValue().getTarget());
        String valueType = "string";
        if (valueShape instanceof CollectionShape) {
            valueType = "string[]";
        }
        writer.write("let parsedQuery: Record<string, $L> = {}", valueType);
        writer.openBlock("for (const [key, value] of Object.entries(query)) {", "}", () -> {
            writer.write("let queryValue: string;");
            final String parsedValue;
            if (valueShape instanceof CollectionShape) {
                writer.write("const valueArray = Array.isArray(value) ? (value as string[]) : [value as string];");
                parsedValue = getOutputValue(context, mappedBinding.getLocation(),
                        "valueArray", target.getValue(), valueShape);
            } else {
                writer.addImport("SerializationException",
                        "__SerializationException",
                        TypeScriptDependency.SERVER_COMMON);
                writer.openBlock("if (Array.isArray(value)) {", "}",
                        () -> {
                            writer.openBlock("if (value.length === 1) {", "}",
                                    () -> {
                                        writer.write("queryValue = value[0];");
                                    });
                            writer.openBlock("else {", "}", () -> {
                                writer.write("throw new __SerializationException();");
                            });
                        });
                writer.openBlock("else {", "}", () -> {
                    writer.write("queryValue = value as string;");
                });
                parsedValue = getOutputValue(context, mappedBinding.getLocation(),
                                "queryValue", target.getValue(), valueShape);
            }
            writer.write("parsedQuery[key] = $L;", parsedValue);
        });
        String memberName = context.getSymbolProvider().toMemberName(mappedBinding.getMember());
        writer.write("contents.$L = parsedQuery;", memberName);
    }

    private void readPath(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex,
            HttpTrait trait
    ) {
        TypeScriptWriter writer = context.getWriter();
        List<HttpBinding> pathBindings = bindingIndex.getRequestBindings(operation, Location.LABEL);
        if (pathBindings.isEmpty()) {
            return;
        }
        StringBuilder pathRegexBuilder = new StringBuilder();
        for (Segment segment : trait.getUri().getSegments()) {
            pathRegexBuilder.append("/");
            if (segment.isLabel()) {
                // Create a named capture group for the segment so we can grab it later without regard to order.
                pathRegexBuilder.append(String.format("(?<%s>", segment.getContent()));
                if (segment.isGreedyLabel()) {
                    pathRegexBuilder.append(".+");
                } else {
                    pathRegexBuilder.append("[^/]+");
                }
                pathRegexBuilder.append(")");
            } else {
                segment.getContent()
                        .chars()
                        .forEach(c -> {
                            if (REGEX_CHARS.contains((char) c)) {
                                pathRegexBuilder.append('\\');
                            }
                            pathRegexBuilder.append((char) c);
                        });
            }
        }
        writer.write("const pathRegex = new RegExp($S);", pathRegexBuilder.toString());
        writer.write("const parsedPath = output.path.match(pathRegex);");
        writer.openBlock("if (parsedPath?.groups !== undefined) {", "}", () -> {
            for (HttpBinding binding : pathBindings) {
                Shape target = context.getModel().expectShape(binding.getMember().getTarget());
                String memberName = context.getSymbolProvider().toMemberName(binding.getMember());
                // since this is in the path, we should decode early
                String dataSource = String.format("decodeURIComponent(parsedPath.groups.%s)",
                        binding.getLocationName());
                String labelValue = getOutputValue(context, binding.getLocation(),
                        dataSource, binding.getMember(), target);
                writer.write("contents.$L = $L;", memberName, labelValue);
            }
        });
    }

    private void readHost(GenerationContext context, OperationShape operation) {
        TypeScriptWriter writer = context.getWriter();
        if (!operation.hasTrait(EndpointTrait.class)) {
            return;
        }
        EndpointTrait endpointTrait = operation.expectTrait(EndpointTrait.class);
        if (endpointTrait.getHostPrefix().getLabels().isEmpty()) {
            return;
        }
        // Anchor to the beginning since we're looking at the host's prefix
        StringBuilder endpointRegexBuilder = new StringBuilder("^");
        for (Segment segment : endpointTrait.getHostPrefix().getSegments()) {
            if (segment.isLabel()) {
                // Create a named capture group for the segment so we can grab it later without regard to order.
                endpointRegexBuilder.append(String.format("(?<%s>.*)", segment.getContent()));
            } else {
                endpointRegexBuilder.append(segment.getContent().replace(".", "\\."));
            }
        }
        writer.write("const hostRegex = new RegExp($S);", endpointRegexBuilder.toString());
        writer.write("const parsedHost = output.path.match(hostRegex);");
        Shape input = context.getModel().expectShape(operation.getInput().get());
        writer.openBlock("if (parsedHost?.groups !== undefined) {", "}", () -> {
            for (MemberShape member : input.members()) {
                if (member.hasTrait(HostLabelTrait.class)) {
                    Shape target = context.getModel().expectShape(member.getTarget());
                    String memberName = context.getSymbolProvider().toMemberName(member);
                    String labelValue = getOutputValue(context, Location.LABEL,
                            "parsedHost.groups." + member.getMemberName(), member, target);
                    writer.write("contents.$L = $L;", memberName, labelValue);
                }
            }
        });
    }

    private void generateOperationResponseDeserializer(
            GenerationContext context,
            OperationShape operation,
            HttpTrait trait
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference responseType = getApplicationProtocol().getResponseType();
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(context.getModel());
        Model model = context.getModel();
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the response type is imported.
        writer.addUseImports(responseType);
        // e.g., deserializeAws_restJson1_1ExecuteStatement
        String methodName = ProtocolGenerator.getDeserFunctionShortName(symbol);
        String methodLongName = ProtocolGenerator.getDeserFunctionName(symbol, getName());
        String errorMethodName = "de_CommandError";
        // Add the normalized output type.
        Symbol outputType = symbol.expectProperty("outputType", Symbol.class);
        String contextType = CodegenUtils.getOperationDeserializerContextType(context.getSettings(), writer,
                context.getModel(), operation);

        // Handle the general response.
        writer.writeDocs(methodLongName);
        writer.openBlock("export const $L = async(\n"
                       + "  output: $T,\n"
                       + "  context: $L\n"
                       + "): Promise<$T> => {", "}",
                       methodName, responseType, contextType, outputType, () -> {
            // Redirect error deserialization to the dispatcher if we receive an error range
            // status code that's not the modeled code (300 or higher). This allows for
            // returning other 2XX codes that don't match the defined value.
            writer.openBlock("if (output.statusCode !== $L && output.statusCode >= 300) {", "}", trait.getCode(),
                    () -> writer.write("return $L(output, context);", errorMethodName));

            // Start deserializing the response.
            writer.openBlock("const contents: any = map({", "});", () -> {
                writer.write("$$metadata: deserializeMetadata(output),");

                readResponseHeaders(context, operation, bindingIndex, "output");
            });

            List<HttpBinding> documentBindings = readResponseBody(context, operation, bindingIndex);
            // Track all shapes bound to the document so their deserializers may be generated.
            documentBindings.forEach(binding -> {
                Shape target = model.expectShape(binding.getMember().getTarget());
                if (!EventStreamGenerator.isEventStreamShape(target)) {
                    deserializingDocumentShapes.add(target);
                }
            });

            writer.write("return contents;");
        });
        writer.write("");
    }

    private void generateErrorDeserializer(GenerationContext context, StructureShape error) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(context.getModel());
        Model model = context.getModel();
        Symbol errorSymbol = symbolProvider.toSymbol(error);
        String errorDeserMethodName = ProtocolGenerator.getDeserFunctionShortName(errorSymbol) + "Res";
        String errorDeserMethodLongName = ProtocolGenerator.getDeserFunctionName(errorSymbol, context.getProtocolName())
                + "Res";

        String outputName = isErrorCodeInBody ? "parsedOutput" : "output";

        writer.writeDocs(errorDeserMethodLongName);
        writer.openBlock("const $L = async (\n"
                       + "  $L: any,\n"
                       + "  context: __SerdeContext\n"
                       + "): Promise<$T> => {", "};",
                errorDeserMethodName, outputName, errorSymbol, () -> {
            writer.openBlock("const contents: any = map({", "});", () -> {
                readResponseHeaders(context, error, bindingIndex, outputName);
            });

            List<HttpBinding> documentBindings = readErrorResponseBody(context, error, bindingIndex);
            // Track all shapes bound to the document so their deserializers may be generated.
            documentBindings.forEach(binding -> {
                Shape target = model.expectShape(binding.getMember().getTarget());
                deserializingDocumentShapes.add(target);
            });
            // todo: unsupported ssdk feature.
            String serverSdkInfix = context.getSettings().generateServerSdk()
                ? ": any /* $metadata unsupported on ssdk error */"
                : "";

            Symbol materializedErrorSymbol = errorSymbol.toBuilder()
                .putProperty("typeOnly", false)
                .build();
            writer.openBlock("const exception$L = new $T({", "});",
                serverSdkInfix,
                materializedErrorSymbol,
                () -> {
                    writer.write("$$metadata: deserializeMetadata($L),", outputName);
                    writer.write("...contents");
                }
            );
            String errorLocation = this.getErrorBodyLocation(context, outputName + ".body");
            writer.addImport("decorateServiceException", "__decorateServiceException",
                    TypeScriptDependency.AWS_SMITHY_CLIENT);
            writer.write("return __decorateServiceException(exception, $L);", errorLocation);
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
            deserializeErrorDocumentBody(context, error.asStructureShape().get(), responseBindings);
            return responseBindings;
        } else {
            // Deserialize response body just like in a normal response.
            return readResponseBody(context, error, bindingIndex);
        }
    }

    private void readResponseHeaders(
            GenerationContext context,
            Shape operationOrError,
            HttpBindingIndex bindingIndex,
            String outputName
    ) {
        List<HttpBinding> headerBindings = bindingIndex.getResponseBindings(operationOrError, Location.HEADER);
        readNormalHeaders(context, headerBindings, outputName);

        List<HttpBinding> prefixHeaderBindings =
                bindingIndex.getResponseBindings(operationOrError, Location.PREFIX_HEADERS);
        readPrefixHeaders(context, prefixHeaderBindings, outputName);
    }

    private void readRequestHeaders(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex,
            String outputName
    ) {
        List<HttpBinding> headerBindings = bindingIndex.getRequestBindings(operation, Location.HEADER);
        readNormalHeaders(context, headerBindings, outputName);

        List<HttpBinding> prefixHeaderBindings =
                bindingIndex.getRequestBindings(operation, Location.PREFIX_HEADERS);
        readPrefixHeaders(context, prefixHeaderBindings, outputName);
    }

    /**
     * Reads headers that are 1-1 mapped to members via the @httpHeader trait.
     *
     * @param context the generation context.
     * @param headerBindings a collection of header bindings.
     * @param outputName the name of the output variable to read from.
     */
    private void readNormalHeaders(
            GenerationContext context,
            Collection<HttpBinding> headerBindings,
            String outputName
    ) {
        for (HttpBinding binding : headerBindings) {
            TypeScriptWriter writer = context.getWriter();
            String memberName = context.getSymbolProvider().toMemberName(binding.getMember());
            String headerName = binding.getLocationName().toLowerCase(Locale.US);
            Shape target = context.getModel().expectShape(binding.getMember().getTarget());
            String headerValue = getOutputValue(
                context, binding.getLocation(),
                outputName + ".headers[" + context.getStringStore().var(headerName) + "]",
                binding.getMember(), target
            );
            String checkedValue = outputName + ".headers[" + context.getStringStore().var(headerName) + "]";

            if (checkedValue.equals(headerValue)) {
                writer.write("[$L]: [, $L],", context.getStringStore().var(memberName), headerValue);
            } else {
                writer.write(
                    "[$L]: [() => void 0 !== $L, () => $L],",
                    context.getStringStore().var(memberName), checkedValue, headerValue
                );
            }
        }
    }

    /**
     * Reads headers are bound by the @httpPrefixHeaders trait.
     *
     * @param context the generation context.
     * @param prefixHeaderBindings a collection of prefix header bindings.
     * @param outputName the name of the output variable to read from.
     */
    private void readPrefixHeaders(
            GenerationContext context,
            Collection<HttpBinding> prefixHeaderBindings,
            String outputName
    ) {
        if (prefixHeaderBindings.isEmpty()) {
            return;
        }

        Model model = context.getModel();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        TypeScriptWriter writer = context.getWriter();

        // Run through the headers one time, matching any prefix groups.
        for (HttpBinding binding : prefixHeaderBindings) {
            // Prepare a grab bag for these headers if necessary
            String memberName = symbolProvider.toMemberName(binding.getMember());
            writer.openBlock("$L: [, ", "],", memberName, () -> {
                String headerLocation = binding.getLocationName().toLowerCase(Locale.US);
                writer.write(
                    "Object.keys($L.headers).filter(header => header.startsWith('$L'))",
                    outputName,
                    headerLocation
                );
                writer.indent().openBlock(".reduce((acc, header) => {", "}, {} as any)", () -> {
                    MapShape prefixMap = model.expectShape(binding.getMember().getTarget()).asMapShape().get();
                    Shape target = model.expectShape(prefixMap.getValue().getTarget());
                    String headerValue = getOutputValue(context, binding.getLocation(),
                        outputName + ".headers[header]", binding.getMember(), target);
                    writer.write("acc[header.substring($L)] = $L;",
                        headerLocation.length(), headerValue);
                    writer.write("return acc;");
                });
            });
        }
    }

    private List<HttpBinding> readRequestBody(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        List<HttpBinding> documentBindings = bindingIndex.getRequestBindings(operation, Location.DOCUMENT);
        documentBindings.sort(Comparator.comparing(HttpBinding::getMemberName));
        List<HttpBinding> payloadBindings = bindingIndex.getRequestBindings(operation, Location.PAYLOAD);
        return readBody(context, operation, documentBindings, payloadBindings, Collections.emptyList(), false);
    }

    private List<HttpBinding> readResponseBody(
            GenerationContext context,
            Shape operationOrError,
            HttpBindingIndex bindingIndex
    ) {
        List<HttpBinding> documentBindings = bindingIndex.getResponseBindings(operationOrError, Location.DOCUMENT);
        documentBindings.sort(Comparator.comparing(HttpBinding::getMemberName));
        List<HttpBinding> payloadBindings = bindingIndex.getResponseBindings(operationOrError, Location.PAYLOAD);
        List<HttpBinding> responseCodeBindings = bindingIndex.getResponseBindings(
                operationOrError, Location.RESPONSE_CODE);
        return readBody(context, operationOrError, documentBindings, payloadBindings, responseCodeBindings, true);
    }

    private List<HttpBinding> readBody(
            GenerationContext context,
            Shape operationOrError,
            List<HttpBinding> documentBindings,
            List<HttpBinding> payloadBindings,
            List<HttpBinding> responseCodeBindings,
            boolean isInput
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        if (!documentBindings.isEmpty()) {
            // If the response has document bindings, the body can be parsed to a JavaScript object.
            writer.addImport("expectObject", "__expectObject", TypeScriptDependency.AWS_SMITHY_CLIENT);
            writer.addImport("expectNonNull", "__expectNonNull", TypeScriptDependency.AWS_SMITHY_CLIENT);
            String bodyLocation = "(__expectObject(await parseBody(output.body, context)))";
            // Use the protocol specific error location for retrieving contents.
            if (operationOrError instanceof StructureShape) {
                bodyLocation = getErrorBodyLocation(context, bodyLocation);
            }
            writer.write("const data: Record<string, any> = __expectNonNull($L, $S);", bodyLocation, "body");

            if (isInput) {
                deserializeInputDocumentBody(context, operationOrError.asOperationShape().get(), documentBindings);
            } else if (operationOrError.isOperationShape()) {
                deserializeOutputDocumentBody(context, operationOrError.asOperationShape().get(), documentBindings);
            } else {
                deserializeErrorDocumentBody(context, operationOrError.asStructureShape().get(), documentBindings);
            }
        }
        if (!payloadBindings.isEmpty()) {
            HttpBinding payloadBinding = payloadBindings.get(0);
            if (isInput) {
                deserializeInputPayload(context, operationOrError.asOperationShape().get(), payloadBinding);
            } else if (operationOrError.isOperationShape()) {
                deserializeOutputPayload(context, operationOrError.asOperationShape().get(), payloadBinding);
            } else {
                deserializeErrorPayload(context, operationOrError.asStructureShape().get(), payloadBinding);
            }
            if (payloadBinding != null) {
                documentBindings = ListUtils.of(payloadBinding);
            }
        }

        // Handle any potential httpResponseCode binding overrides if the field
        // isn't set in the body.
        // These are only relevant when a payload is not present, as it cannot
        // coexist with a payload.
        if (!responseCodeBindings.isEmpty()) {
            writer.openBlock("map(contents, {", "});", () -> {
                for (HttpBinding responseCodeBinding : responseCodeBindings) {
                    // The name of the member to get from the input shape.
                    String memberName = symbolProvider.toMemberName(responseCodeBinding.getMember());

                    writer.write("$L: [, output.statusCode]", memberName);
                }
            });
        }

        if (!documentBindings.isEmpty()) {
            return documentBindings;
        }

        // If there are no payload or document bindings, the body still needs to be
        // collected so the process can exit.
        writer.write("await collectBody(output.body, context);");
        return ListUtils.of();
    }

    private HttpBinding readPayload(
            GenerationContext context,
            HttpBinding binding
    ) {
        TypeScriptWriter writer = context.getWriter();
        boolean isClientSdk = context.getSettings().generateClient();

        // There can only be one payload binding.
        Shape target = context.getModel().expectShape(binding.getMember().getTarget());

        boolean isStreaming = target.hasTrait(StreamingTrait.class);

        // Handle streaming shapes differently.
        if (isStreaming) {
            writer.write("const data: any = output.body;");
            // If payload is streaming blob, return low-level stream with the stream utility functions mixin.
            if (isClientSdk && target instanceof BlobShape) {
                writer.write("context.sdkStreamMixin(data);");
            }
        } else if (target instanceof BlobShape) {
            // If payload is non-streaming Blob, only need to collect stream to binary data (Uint8Array).
            writer.write("const data: any = await collectBody(output.body, context);");
        } else if (target instanceof StructureShape) {
            // If payload is a Structure, then we need to parse the string into JavaScript object.
            writer.addImport("expectObject", "__expectObject", TypeScriptDependency.AWS_SMITHY_CLIENT);
            writer.write("const data: Record<string, any> | undefined "
                    + "= __expectObject(await parseBody(output.body, context));");
        } else if (target instanceof UnionShape) {
            // If payload is a Union, then we need to parse the string into JavaScript object.
            writer.write("const data: Record<string, any> | undefined "
                    + "= await parseBody(output.body, context);");
        } else if (target instanceof StringShape || target instanceof DocumentShape) {
            // If payload is String or Document, we need to collect body and convert binary to string.
            writer.write("const data: any = await collectBodyString(output.body, context);");
        } else {
            throw new CodegenException(String.format("Unexpected shape type bound to payload: `%s`",
                    target.getType()));
        }

        if (!isStreaming && target instanceof UnionShape) {
            writer.openBlock(
                "if (Object.keys(data ?? {}).length) {",
                "}",
                () -> {
                    importUnionDeserializer(writer);
                    writer.write("contents.$L = __expectUnion($L);", binding.getMemberName(), getOutputValue(context,
                        Location.PAYLOAD, "data", binding.getMember(), target));
                }
            );
        } else {
            writer.write("contents.$L = $L;", binding.getMemberName(), getOutputValue(context,
                Location.PAYLOAD, "data", binding.getMember(), target));
        }

        return binding;
    }

    protected void importUnionDeserializer(TypeScriptWriter writer) {
        writer.addImport("expectUnion", "__expectUnion", TypeScriptDependency.AWS_SMITHY_CLIENT);
    }

    /**
     * Writes the code needed to deserialize the input payload of a request.
     *
     * <p>Implementations of this method are expected to set a value to the
     * bound member name of the {@code contents} variable after deserializing
     * the response body. This variable will already be defined in scope.
     *
     * @param context The generation context.
     * @param operation The operation whose input payload is being deserialized.
     * @param binding The payload binding to deserialize.
     * @return The deserialized payload binding.
     */
    protected HttpBinding deserializeInputPayload(
            GenerationContext context,
            OperationShape operation,
            HttpBinding binding
    ) {
        return readPayload(context, binding);
    }

    /**
     * Writes the code needed to deserialize the output payload of a response.
     *
     * <p>Implementations of this method are expected to set a value to the
     * bound member name of the {@code contents} variable after deserializing
     * the response body. This variable will already be defined in scope.
     *
     * @param context The generation context.
     * @param operation The operation whose output payload is being deserialized.
     * @param binding The payload binding to deserialize.
     * @return The deserialized payload binding.
     */
    protected HttpBinding deserializeOutputPayload(
            GenerationContext context,
            OperationShape operation,
            HttpBinding binding
    ) {
        return readPayload(context, binding);
    }

    /**
     * Writes the code needed to deserialize the error payload of a response.
     *
     * <p>Implementations of this method are expected to set a value to the
     * bound member name of the {@code contents} variable after deserializing
     * the response body. This variable will already be defined in scope.
     *
     * @param context The generation context.
     * @param error The error whose payload is being deserialized.
     * @param binding The payload binding to deserialize.
     * @return The deserialized payload binding.
     */
    protected HttpBinding deserializeErrorPayload(
            GenerationContext context,
            StructureShape error,
            HttpBinding binding
    ) {
        return readPayload(context, binding);
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
            return getNumberOutputParam(context, bindingType, dataSource, target);
        } else if (target instanceof BooleanShape) {
            return getBooleanOutputParam(context, bindingType, dataSource);
        } else if (target instanceof StringShape) {
            return getStringOutputParam(context, bindingType, dataSource, target);
        } else if (target instanceof DocumentShape) {
            return dataSource;
        } else if (target instanceof TimestampShape) {
            HttpBindingIndex httpIndex = HttpBindingIndex.of(context.getModel());
            Format format = httpIndex.determineTimestampFormat(member, bindingType, getDocumentTimestampFormat());
            return HttpProtocolGeneratorUtils.getTimestampOutputParam(
                    context.getWriter(), dataSource, bindingType, member, format,
                    requiresNumericEpochSecondsInPayload(), context.getSettings().generateClient());
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
     * boolean. By default, this checks strict equality to 'true' in headers and passes
     * through for documents.
     *
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @return Returns a value or expression of the output boolean.
     */
    private String getBooleanOutputParam(GenerationContext context, Location bindingType, String dataSource) {
        switch (bindingType) {
            case QUERY:
            case LABEL:
            case HEADER:
                context.getWriter().addImport("parseBoolean", "__parseBoolean", TypeScriptDependency.AWS_SMITHY_CLIENT);
                return String.format("__parseBoolean(%s)", dataSource);
            default:
                throw new CodegenException("Unexpected boolean binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * string. By default, this base64 decodes content in headers if there is a
     * mediaType applied to the string, and passes through for all other cases.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation input.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the input string.
     */
    private String getStringOutputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            Shape target
    ) {
        // Decode these to base64 if a MediaType is present.
        if (bindingType == Location.HEADER && target.hasTrait(MediaTypeTrait.ID)) {
            dataSource = "Buffer.from(context.base64Decoder(" + dataSource + ")).toString('utf8')";
        }

        return HttpProtocolGeneratorUtils.getStringOutputParam(
                context, target, dataSource, !isGuaranteedString(bindingType));
    }

    private boolean isGuaranteedString(Location bindingType) {
        return bindingType != Location.PAYLOAD && bindingType != Location.DOCUMENT;
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
            case QUERY:
            case LABEL:
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
        boolean trimParameterValue = bindingType != Location.QUERY && bindingType != Location.QUERY_PARAMS;
        String outputValueDataSource = "_entry";
        if (trimParameterValue) {
            outputValueDataSource += ".trim()";
        }
        String collectionTargetValue = getOutputValue(context, bindingType, outputValueDataSource,
                targetMember, collectionTarget);
        String outputParam;
        switch (bindingType) {
            case QUERY_PARAMS:
            case QUERY:
                if (collectionTargetValue.equals("_entry")) {
                    return String.format("%1$s", dataSource);
                }
                return String.format("%1$s.map(_entry => %2$s as any)", dataSource, collectionTargetValue);
            case LABEL:
                dataSource = "(" + dataSource + " || \"\")";
                // Split these values on slashes.
                outputParam = "" + dataSource + ".split('/')";

                // Iterate over each entry and do deser work.
                if (!collectionTargetValue.equals("_entry")) {
                    outputParam += ".map(_entry => " + collectionTargetValue + " as any)";
                }

                return outputParam;
            case HEADER:
                dataSource = "(" + dataSource + " || \"\")";
                // Split these values on commas.
                context.getWriter().addImport("splitHeader", "__splitHeader", TypeScriptDependency.AWS_SMITHY_CLIENT);
                outputParam = "__splitHeader(" + dataSource + ")";

                // Headers that have HTTP_DATE formatted timestamps already contain a ","
                // in their formatted entry, so split on every other "," instead.
                if (collectionTarget.isTimestampShape()) {
                    // Check if our member resolves to the HTTP_DATE format.
                    HttpBindingIndex httpIndex = HttpBindingIndex.of(context.getModel());
                    Format format = httpIndex.determineTimestampFormat(targetMember, bindingType, Format.HTTP_DATE);

                    if (format == Format.HTTP_DATE) {
                        TypeScriptWriter writer = context.getWriter();
                        writer.addImport("splitEvery", "__splitEvery", TypeScriptDependency.AWS_SMITHY_CLIENT);
                        outputParam = "__splitEvery(" + dataSource + ", ',', 2)";
                    }
                }

                // Iterate over each entry and do deser work.
                if (!collectionTargetValue.equals("_entry")) {
                    outputParam += ".map(_entry => " + collectionTargetValue + " as any)";
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

                boolean mayElideOutput = SerdeElisionIndex.of(context.getModel()).mayElide(target)
                        && (enableSerdeElision() && !context.getSettings().generateServerSdk());

                if (mayElideOutput) {
                    context.getWriter().addImport("_json", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
                    return "_json(" + dataSource + ")";
                }

                return ProtocolGenerator.getDeserFunctionShortName(symbol)
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
    private String getNumberOutputParam(
            GenerationContext context,
            Location bindingType,
            String dataSource,
            Shape target
    ) {
        switch (bindingType) {
            case QUERY:
            case LABEL:
            case HEADER:
                switch (target.getType()) {
                    case DOUBLE:
                        context.getWriter().addImport(
                                "strictParseDouble", "__strictParseDouble", TypeScriptDependency.AWS_SMITHY_CLIENT);
                        return "__strictParseDouble(" + dataSource + ")";
                    case FLOAT:
                        context.getWriter().addImport(
                                "strictParseFloat", "__strictParseFloat", TypeScriptDependency.AWS_SMITHY_CLIENT);
                        return "__strictParseFloat(" + dataSource + ")";
                    case LONG:
                        context.getWriter().addImport(
                                "strictParseLong", "__strictParseLong", TypeScriptDependency.AWS_SMITHY_CLIENT);
                        return "__strictParseLong(" + dataSource + ")";
                    case INT_ENUM:
                    case INTEGER:
                        context.getWriter().addImport(
                                "strictParseInt32", "__strictParseInt32", TypeScriptDependency.AWS_SMITHY_CLIENT);
                        return "__strictParseInt32(" + dataSource + ")";
                    case SHORT:
                        context.getWriter().addImport(
                                "strictParseShort", "__strictParseShort", TypeScriptDependency.AWS_SMITHY_CLIENT);
                        return "__strictParseShort(" + dataSource + ")";
                    case BYTE:
                        context.getWriter().addImport(
                                "strictParseByte", "__strictParseByte", TypeScriptDependency.AWS_SMITHY_CLIENT);
                        return "__strictParseByte(" + dataSource + ")";
                    default:
                        throw new CodegenException("Unexpected number shape `" + target.getType() + "`");
                }
            default:
                throw new CodegenException("Unexpected number binding location `" + bindingType + "`");
        }
    }

    /**
     * Writes the code that loads an optional {@code errorCode} String with the content used
     * to dispatch errors to specific serializers. If an error code cannot be load, the code
     * must return {@code undefined} so default value can be injected in default case.
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
     * const errorCode = output.headers["x-amzn-errortype"].split(':')[0];
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
     * Writes the code needed to deserialize a protocol input document.
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
     * @param context The generation context.
     * @param operation The operation whose input document is being deserialized.
     * @param documentBindings The bindings to read from the document.
     */
    protected abstract void deserializeInputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    );

    /**
     * Writes the code needed to deserialize a protocol output document.
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
     * @param context The generation context.
     * @param operation The operation whose output document is being deserialized.
     * @param documentBindings The bindings to read from the document.
     */
    protected abstract void deserializeOutputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    );

    /**
     * Writes the code needed to deserialize a protocol error document.
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
     * @param context The generation context.
     * @param error The error being deserialized.
     * @param documentBindings The bindings to read from the document.
     */
    protected abstract void deserializeErrorDocumentBody(
            GenerationContext context,
            StructureShape error,
            List<HttpBinding> documentBindings
    );

    /**
     * @return true if this protocol disallows string epoch timestamps in payloads.
     */
    protected abstract boolean requiresNumericEpochSecondsInPayload();

    /**
     * Implement a return true if the protocol allows elision of serde functions.
     *
     * @return whether protocol implementation is compatible with serde elision.
     */
    protected boolean enableSerdeElision() {
        return false;
    }
}
