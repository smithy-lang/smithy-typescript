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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.knowledge.HttpBinding.Location;
import software.amazon.smithy.model.pattern.SmithyPattern;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.EndpointTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.RetryableTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Utility methods for generating HTTP protocols.
 */
@SmithyUnstableApi
@SmithyInternalApi
public final class HttpProtocolGeneratorUtils {

    private static final Logger LOGGER = Logger.getLogger(HttpBindingProtocolGenerator.class.getName());

    private HttpProtocolGeneratorUtils() {}

    /**
     * Given a format and a source of data, generate an input value provider for the
     * timestamp.
     *
     * @param context The generation context.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param shape The shape that represents the value being provided.
     * @param format The timestamp format to provide.
     * @return Returns a value or expression of the input timestamp.
     */
    public static String getTimestampInputParam(
            GenerationContext context,
            String dataSource,
            Shape shape,
            Format format
    ) {
        switch (format) {
            case DATE_TIME:
                context.getWriter().addImport(
                    "serializeDateTime",
                    "__serializeDateTime",
                    TypeScriptDependency.AWS_SMITHY_CLIENT
                );
                return "__serializeDateTime(" + dataSource + ")";
            case EPOCH_SECONDS:
                return "(" + dataSource + ".getTime() / 1_000)";
            case HTTP_DATE:
                context.getWriter().addImport(
                    "dateToUtcString",
                    "__dateToUtcString",
                    TypeScriptDependency.AWS_SMITHY_CLIENT
                );
                return "__dateToUtcString(" + dataSource + ")";
            default:
                throw new CodegenException("Unexpected timestamp format `" + format + "` on " + shape);
        }
    }

    /**
     * Given a format and a source of data, generate an output value provider for the
     * timestamp.
     *
     * @param writer The current writer (so that imports may be added)
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param bindingType How this value is bound to the operation output.
     * @param shape The shape that represents the value being received.
     * @param format The timestamp format to provide.
     * @param requireNumericEpochSecondsInPayload if true, paylaod epoch seconds are not allowed to be coerced
     *                                            from strings.
     * @param isClient true if generating a client.
     * @return Returns a value or expression of the output timestamp.
     */
    public static String getTimestampOutputParam(TypeScriptWriter writer,
                                                 String dataSource,
                                                 Location bindingType,
                                                 Shape shape,
                                                 Format format,
                                                 boolean requireNumericEpochSecondsInPayload,
                                                 boolean isClient) {
        // This has always explicitly wrapped the dataSource in "new Date(..)", so it could never generate
        // an expression that evaluates to null. Codegen relies on this.
        writer.addImport("expectNonNull", "__expectNonNull", TypeScriptDependency.AWS_SMITHY_CLIENT);
        switch (format) {
            case DATE_TIME:
                // Clients should be able to handle offsets and normalize the datetime to an offset of zero.
                if (isClient) {
                    writer.addImport("parseRfc3339DateTimeWithOffset", "__parseRfc3339DateTimeWithOffset",
                        TypeScriptDependency.AWS_SMITHY_CLIENT);
                    return String.format("__expectNonNull(__parseRfc3339DateTimeWithOffset(%s))", dataSource);
                } else {
                    writer.addImport("parseRfc3339DateTime", "__parseRfc3339DateTime",
                        TypeScriptDependency.AWS_SMITHY_CLIENT);
                    return String.format("__expectNonNull(__parseRfc3339DateTime(%s))", dataSource);
                }
            case HTTP_DATE:
                writer.addImport("parseRfc7231DateTime", "__parseRfc7231DateTime",
                    TypeScriptDependency.AWS_SMITHY_CLIENT);
                return String.format("__expectNonNull(__parseRfc7231DateTime(%s))", dataSource);
            case EPOCH_SECONDS:
                writer.addImport("parseEpochTimestamp", "__parseEpochTimestamp",
                    TypeScriptDependency.AWS_SMITHY_CLIENT);
                String modifiedDataSource = dataSource;
                if (requireNumericEpochSecondsInPayload
                        && (bindingType == Location.DOCUMENT || bindingType == Location.PAYLOAD)) {
                    writer.addImport("expectNumber", "__expectNumber", TypeScriptDependency.AWS_SMITHY_CLIENT);
                    modifiedDataSource = String.format("__expectNumber(%s)", dataSource);
                }
                return String.format("__expectNonNull(__parseEpochTimestamp(%s))", modifiedDataSource);
            default:
                throw new CodegenException("Unexpected timestamp format `" + format.toString() + "` on " + shape);
        }
    }

    /**
     * Given a String input, determine its media type and generate an input value
     * provider for it.
     *
     * <p>This currently only supports using the LazyJsonString for {@code "application/json"}.
     *
     * @param context The generation context.
     * @param shape The shape that represents the value being provided.
     * @param dataSource The in-code location of the data to provide an input of
     *   ({@code input.foo}, {@code entry}, etc.)
     * @return Returns a value or expression of the input string.
     */
    public static String getStringInputParam(GenerationContext context, Shape shape, String dataSource) {
        // Handle media type generation, defaulting to the dataSource.
        Optional<MediaTypeTrait> mediaTypeTrait = shape.getTrait(MediaTypeTrait.class);
        if (mediaTypeTrait.isPresent()) {
            String mediaType = mediaTypeTrait.get().getValue();
            if (CodegenUtils.isJsonMediaType(mediaType)) {
                TypeScriptWriter writer = context.getWriter();
                writer.addImport("LazyJsonString", "__LazyJsonString", TypeScriptDependency.AWS_SMITHY_CLIENT);
                return "__LazyJsonString.from(" + dataSource + ")";
            } else {
                LOGGER.warning(() -> "Found unsupported mediatype " + mediaType + " on String shape: " + shape);
            }
        }

        return dataSource;
    }

    /**
     * Given a String output, determine its media type and generate an output value
     * provider for it.
     *
     * <p>This currently only supports using the LazyJsonString for {@code "application/json"}.
     *
     * @param context The generation context.
     * @param shape The shape that represents the value being received.
     * @param dataSource The in-code location of the data to provide an output of
     *   ({@code output.foo}, {@code entry}, etc.)
     * @param useExpect Whether or not to wrap the string in expectString. This should
     *   only be false if the value is guaranteed to be a string already.
     * @return Returns a value or expression of the output string.
     */
    public static String getStringOutputParam(GenerationContext context,
                                              Shape shape,
                                              String dataSource,
                                              boolean useExpect) {
        // Handle media type generation, defaulting to a standard String.
        Optional<MediaTypeTrait> mediaTypeTrait = shape.getTrait(MediaTypeTrait.class);
        if (mediaTypeTrait.isPresent()) {
            String mediaType = mediaTypeTrait.get().getValue();
            if (CodegenUtils.isJsonMediaType(mediaType)) {
                TypeScriptWriter writer = context.getWriter();
                writer.addImport("LazyJsonString", "__LazyJsonString", TypeScriptDependency.AWS_SMITHY_CLIENT);
                return "__LazyJsonString.from(" + dataSource + ")";
            } else {
                LOGGER.warning(() -> "Found unsupported mediatype " + mediaType + " on String shape: " + shape);
            }
        }

        if (!useExpect) {
            return dataSource;
        }
        context.getWriter().addImport("expectString", "__expectString", TypeScriptDependency.AWS_SMITHY_CLIENT);
        return "__expectString(" + dataSource + ")";
    }

    /**
     * Given a String output, determine its media type and generate an output value
     * provider for it.
     *
     * <p>This currently only supports using the LazyJsonString for {@code "application/json"}.
     *
     * @param context The generation context.
     * @param shape The shape that represents the value being received.
     * @param dataSource The in-code location of the data to provide an output of
     *   ({@code output.foo}, {@code entry}, etc.)
     * @return Returns a value or expression of the output string.
     */
    public static String getStringOutputParam(GenerationContext context, Shape shape, String dataSource) {
        return getStringOutputParam(context, shape, dataSource, true);
    }

    /**
     * Writes a response metadata deserializer function for HTTP protocols. This
     * will load things like the status code, headers, and more.
     *
     * @param context The generation context.
     * @param responseType The response type for the HTTP protocol.
     */
    public static void generateMetadataDeserializer(GenerationContext context, SymbolReference responseType) {
        TypeScriptWriter writer = context.getWriter();

        writer.addImport("ResponseMetadata", "__ResponseMetadata", TypeScriptDependency.SMITHY_TYPES);
        writer.openBlock("const deserializeMetadata = (output: $T): __ResponseMetadata => ({", "});", responseType,
                () -> {
                    writer.write("httpStatusCode: output.statusCode,");
                    writer.write("requestId: output.headers[\"x-amzn-requestid\"] ??"
                        + " output.headers[\"x-amzn-request-id\"] ??"
                        + " output.headers[\"x-amz-request-id\"],");
                    writer.write("extendedRequestId: output.headers[\"x-amz-id-2\"],");
                    writer.write("cfId: output.headers[\"x-amz-cf-id\"],");
                });
        writer.write("");
    }

    /**
     * Writes a function converting the low-level response body stream to utf-8 encoded string. It depends on
     * response body stream collector.
     *
     * @param context The generation context
     */
    public static void generateCollectBodyString(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();
        writer.addImport("collectBody", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
        writer.addImport("SerdeContext", "__SerdeContext", TypeScriptDependency.SMITHY_TYPES);
        writer.write("// Encode Uint8Array data into string with utf-8.");
        writer.write("const collectBodyString = (streamBody: any, context: __SerdeContext): Promise<string> => "
                + "collectBody(streamBody, context).then(body => context.utf8Encoder(body))");
        writer.write("");
    }

    /**
     * Writes $retryable key for error if it contains RetryableTrait.
     *
     * @param writer The code writer.
     * @param error The error to write retryableTrait for.
     * @param separator The string to be used after emitting key-value pair for retryableTrait.
     */
    public static void writeRetryableTrait(TypeScriptWriter writer, StructureShape error, String separator) {
        Optional<RetryableTrait> retryableTrait = error.getTrait(RetryableTrait.class);
        if (retryableTrait.isPresent()) {
            String textAfterBlock = String.format("}%s", separator);
            writer.openBlock("$$retryable = {", textAfterBlock, () -> {
                if (retryableTrait.get().getThrottling()) {
                    writer.write("throttling: true,");
                }
            });
        }
    }

    /**
     * Writes a function used to dispatch to the proper error deserializer
     * for each error that any operation can return. The generated function
     * assumes a deserialization function is generated for the structures
     * returned.
     *
     * @param context The generation context.
     * @param responseType The response type for the HTTP protocol.
     * @param errorCodeGenerator A consumer
     * @param shouldParseErrorBody Flag indicating whether need to parse response body in this dispatcher function
     * @param bodyErrorLocationModifier A function that returns the location of an error in a body given a data source.
     * @param operationErrorsToShapes A map of error names to their {@link ShapeId}.
     * @return A set of all error structure shapes for the operation that were dispatched to.
     */
    public static Set<StructureShape> generateUnifiedErrorDispatcher(
        GenerationContext context,
        List<OperationShape> operations,
        SymbolReference responseType,
        Consumer<GenerationContext> errorCodeGenerator,
        boolean shouldParseErrorBody,
        BiFunction<GenerationContext, String, String> bodyErrorLocationModifier,
        BiFunction<GenerationContext, List<OperationShape>, Map<String, ShapeId>> operationErrorsToShapes
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Set<StructureShape> errorShapes = new TreeSet<>();

        String errorMethodName = "de_CommandError";
        String errorMethodLongName = "deserialize_"
            + ProtocolGenerator.getSanitizedName(context.getProtocolName())
            + "CommandError";

        writer.writeDocs(errorMethodLongName);
        writer.openBlock("const $L = async(\n"
            + "  output: $T,\n"
            + "  context: __SerdeContext,\n"
            + "): Promise<never> => {", "}", errorMethodName, responseType, () -> {
            // Prepare error response for parsing error code. If error code needs to be parsed from response body
            // then we collect body and parse it to JS object, otherwise leave the response body as is.
            if (shouldParseErrorBody) {
                writer.openBlock("const parsedOutput: any = {", "};",
                    () -> {
                        writer.write("...output,");
                        writer.write("body: await parseErrorBody(output.body, context)");
                    });
            }

            // Error responses must be at least BaseException interface
            errorCodeGenerator.accept(context);

            Runnable defaultErrorHandler = () -> {
                if (shouldParseErrorBody) {
                    // Body is already parsed above
                    writer.write("const parsedBody = parsedOutput.body;");
                } else {
                    // Body is not parsed above, so parse it here
                    writer.write("const parsedBody = await parseBody(output.body, context);");
                }

                // Get the protocol specific error location for retrieving contents.
                String errorLocation = bodyErrorLocationModifier.apply(context, "parsedBody");
                writer.openBlock("return throwDefaultError({", "}) as never", () -> {
                    writer.write("output,");
                    if (errorLocation.equals("parsedBody")) {
                        writer.write("parsedBody,");
                    } else {
                        writer.write("parsedBody: $L,", errorLocation);
                    }
                    writer.write("errorCode");
                });
            };

            Map<String, ShapeId> operationNamesToShapes = operationErrorsToShapes.apply(context, operations);

            if (!operationNamesToShapes.isEmpty()) {
                writer.openBlock("switch (errorCode) {", "}", () -> {
                    // Generate the case statement for each error, invoking the specific deserializer.

                    operationNamesToShapes.forEach((name, errorId) -> {
                        StructureShape error = context.getModel().expectShape(errorId).asStructureShape().get();
                        // Track errors bound to the operation so their deserializers may be generated.
                        errorShapes.add(error);
                        Symbol errorSymbol = symbolProvider.toSymbol(error);
                        String errorDeserMethodName = ProtocolGenerator.getDeserFunctionShortName(errorSymbol) + "Res";
                        // Dispatch to the error deserialization function.
                        String outputParam = shouldParseErrorBody ? "parsedOutput" : "output";
                        writer.write("case $S:", name);
                        writer.write("case $S:", errorId.toString());
                        writer.indent()
                            .write("throw await $L($L, context);", errorDeserMethodName, outputParam)
                            .dedent();
                    });

                    // Build a generic error the best we can for ones we don't know about.
                    writer.write("default:").indent();
                    defaultErrorHandler.run();
                });
            } else {
                defaultErrorHandler.run();
            }
        });
        writer.write("");

        return errorShapes;
    }

    /**
     * Writes resolved hostname, prepending existing hostname with hostPrefix and replacing each hostLabel with
     * the corresponding top-level input member value.
     *
     * @param context The generation context.
     * @param operation The operation to generate for.
     */
    public static void writeHostPrefix(GenerationContext context, OperationShape operation) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        EndpointTrait trait = operation.getTrait(EndpointTrait.class).get();
        writer.write("let { hostname: resolvedHostname } = await context.endpoint();");
        // Check if disableHostPrefixInjection has been set to true at runtime
        writer.openBlock("if (context.disableHostPrefix !== true) {", "}", () -> {
            writer.addImport("isValidHostname", "__isValidHostname", TypeScriptDependency.PROTOCOL_HTTP);
            writer.write("resolvedHostname = $S + resolvedHostname;", trait.getHostPrefix().toString());
            if (operation.getInput().isPresent()) {
                List<SmithyPattern.Segment> prefixLabels = trait.getHostPrefix().getLabels();
                StructureShape inputShape = context.getModel().expectShape(operation.getInput()
                        .get(), StructureShape.class);
                for (SmithyPattern.Segment label : prefixLabels) {
                    MemberShape member = inputShape.getMember(label.getContent()).get();
                    String memberName = symbolProvider.toMemberName(member);
                    writer.openBlock("if (input.$L === undefined) {", "}", memberName, () -> {
                        writer.write("throw new Error('Empty value provided for input host prefix: $L.');", memberName);
                    });
                    writer.write("resolvedHostname = resolvedHostname.replace(\"{$L}\", input.$L!)",
                            label.getContent(), memberName);
                }
            }
            writer.openBlock("if (!__isValidHostname(resolvedHostname)) {", "}", () -> {
                writer.write("throw new Error(\"ValidationError: prefixed hostname must be hostname compatible.\");");
            });
        });
    }

    /**
     * Construct a symbol reference of client's base exception class.
     */
    public static SymbolReference getClientBaseException(GenerationContext context) {
        ServiceShape service = context.getService();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        String serviceExceptionName = symbolProvider.toSymbol(service).getName()
                        .replaceAll("(Client)$", "ServiceException");
        String namespace = Paths.get(".", "src", "models", serviceExceptionName).toString();
        Symbol serviceExceptionSymbol = Symbol.builder()
                            .name(serviceExceptionName)
                            .namespace(namespace, "/")
                            .definitionFile(namespace + ".ts").build();
        return SymbolReference.builder()
                .options(SymbolReference.ContextOption.USE)
                .alias("__BaseException")
                .symbol(serviceExceptionSymbol)
                .build();
    }

    /**
     * Returns a map of error names to their {@link ShapeId}.
     *
     * @param context   the generation context
     * @param operation the operation shape to retrieve errors for
     * @return map of error names to {@link ShapeId}
     */
    public static Map<String, ShapeId> getOperationErrors(GenerationContext context, OperationShape operation) {
        return operation.getErrors().stream()
            .collect(Collectors.toMap(
                shapeId -> shapeId.getName(context.getService()),
                Function.identity(),
                (x, y) -> {
                    if (!x.equals(y)) {
                        throw new CodegenException(String.format("conflicting error shape ids: %s, %s", x, y));
                    }
                    return x;
                }, TreeMap::new));
    }
}
