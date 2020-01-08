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
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;

/**
 * Utility methods for generating HTTP protocols.
 */
final class HttpProtocolGeneratorUtils {

    private HttpProtocolGeneratorUtils() {}

    /**
     * Given a format and a source of data, generate an input value provider for the
     * timestamp.
     *
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param shape The shape that represents the value being provided.
     * @param format The timestamp format to provide.
     * @return Returns a value or expression of the input timestamp.
     */
    static String getTimestampInputParam(String dataSource, Shape shape, Format format) {
        switch (format) {
            case DATE_TIME:
                return dataSource + ".toISOString()";
            case EPOCH_SECONDS:
                return "Math.round(" + dataSource + ".getTime() / 1000)";
            case HTTP_DATE:
                return dataSource + ".toUTCString()";
            default:
                throw new CodegenException("Unexpected timestamp format `" + format.toString() + "` on " + shape);
        }
    }

    /**
     * Given a format and a source of data, generate an output value provider for the
     * timestamp.
     *
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param shape The shape that represents the value being received.
     * @param format The timestamp format to provide.
     * @return Returns a value or expression of the output timestamp.
     */
    static String getTimestampOutputParam(String dataSource, Shape shape, Format format) {
        String modifiedSource;
        switch (format) {
            case DATE_TIME:
            case HTTP_DATE:
                modifiedSource = dataSource;
                break;
            case EPOCH_SECONDS:
                // Account for seconds being sent over the wire in some cases where milliseconds are required.
                modifiedSource = dataSource + " % 1 != 0 ? Math.round(" + dataSource + " * 1000) : " + dataSource;
                break;
            default:
                throw new CodegenException("Unexpected timestamp format `" + format.toString() + "` on " + shape);
        }

        return "new Date(" + modifiedSource + ")";
    }

    /**
     * Writes a response metadata deserializer function for HTTP protocols. This
     * will load things like the status code, headers, and more.
     *
     * @param context The generation context.
     * @param responseType The response type for the HTTP protocol.
     */
    static void generateMetadataDeserializer(GenerationContext context, SymbolReference responseType) {
        TypeScriptWriter writer = context.getWriter();

        writer.addImport("ResponseMetadata", "__ResponseMetadata", "@aws-sdk/types");
        writer.openBlock("const deserializeMetadata = (output: $T): __ResponseMetadata => ({", "});", responseType,
                () -> {
                    writer.write("httpStatusCode: output.statusCode,");
                    writer.write("httpHeaders: output.headers,");
                    writer.write("requestId: output.headers[\"x-amzn-requestid\"]");
                });
        writer.write("");
    }

    /**
     * Writes a function used to dispatch to the proper error deserializer
     * for each error that the operation can return. The generated function
     * assumes a deserialization function is generated for the structures
     * returned.
     *
     * @param context The generation context.
     * @param operation The operation to generate for.
     * @param responseType The response type for the HTTP protocol.
     * @param errorCodeGenerator A consumer
     * @return A set of all error structure shapes for the operation that were dispatched to.
     */
    static Set<StructureShape> generateErrorDispatcher(
            GenerationContext context,
            OperationShape operation,
            SymbolReference responseType,
            Consumer<GenerationContext> errorCodeGenerator
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Set<StructureShape> errorShapes = new TreeSet<>();

        Symbol symbol = symbolProvider.toSymbol(operation);
        Symbol outputType = symbol.expectProperty("outputType", Symbol.class);
        String errorMethodName = ProtocolGenerator.getDeserFunctionName(symbol, context.getProtocolName()) + "Error";

        writer.openBlock("async function $L(\n"
                       + "  output: $T,\n"
                       + "  context: __SerdeContext,\n"
                       + "): Promise<$T> {", "}", errorMethodName, responseType, outputType, () -> {
            writer.write("const data: any = await parseBody(output.body, context);");
            // We only consume the parsedOutput if we're dispatching, so only generate if we will.
            if (!operation.getErrors().isEmpty()) {
                // Create a holding object since we have already parsed the body, but retain the rest of the output.
                writer.openBlock("const parsedOutput: any = {", "};", () -> {
                    writer.write("...output,");
                    writer.write("body: data,");
                });
            }

            // Error responses must be at least SmithyException and MetadataBearer implementations.
            writer.addImport("SmithyException", "__SmithyException",
                    TypeScriptDependency.AWS_SMITHY_CLIENT.packageName);
            writer.addImport("MetadataBearer", "__MetadataBearer",
                    TypeScriptDependency.AWS_SDK_TYPES.packageName);
            writer.write("let response: __SmithyException & __MetadataBearer;");
            writer.write("let errorCode: String = \"UnknownError\";");
            errorCodeGenerator.accept(context);
            writer.openBlock("switch (errorCode) {", "}", () -> {
                // Generate the case statement for each error, invoking the specific deserializer.
                new TreeSet<>(operation.getErrors()).forEach(errorId -> {
                    StructureShape error = context.getModel().expectShape(errorId).asStructureShape().get();
                    // Track errors bound to the operation so their deserializers may be generated.
                    errorShapes.add(error);
                    Symbol errorSymbol = symbolProvider.toSymbol(error);
                    String errorDeserMethodName = ProtocolGenerator.getDeserFunctionName(errorSymbol,
                            context.getProtocolName()) + "Response";
                    writer.openBlock("case $S:\ncase $S:", "  break;", errorId.getName(), errorId.toString(), () -> {
                        // Dispatch to the error deserialization function.
                        writer.write("response = await $L(parsedOutput, context);", errorDeserMethodName);
                    });
                });

                // Build a generic error the best we can for ones we don't know about.
                writer.write("default:").indent()
                        .openBlock("response = {", "};", () -> {
                            writer.write("__type: `$L#$${errorCode}`,", operation.getId().getNamespace());
                            writer.write("$$fault: \"client\",");
                            writer.write("$$metadata: deserializeMetadata(output),");
                        }).dedent();
            });
            writer.write("return Promise.reject(Object.assign(new Error(response.__type), response));");
        });
        writer.write("");

        return errorShapes;
    }
}
