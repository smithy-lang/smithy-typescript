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

import java.util.Iterator;
import java.util.Set;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;

final class ServerGenerator {

    private ServerGenerator() {}

    static void generateOperationsType(SymbolProvider symbolProvider,
                                       Shape serviceShape,
                                       Set<OperationShape> operations,
                                       TypeScriptWriter writer) {
        Symbol serviceSymbol = symbolProvider.toSymbol(serviceShape);
        writer.writeInline("export type $L = ", serviceSymbol.expectProperty("operations", Symbol.class).getName());
        for (Iterator<OperationShape> iter = operations.iterator(); iter.hasNext();) {
            writer.writeInline("$S", iter.next().getId().getName());
            if (iter.hasNext()) {
                writer.writeInline(" | ");
            }
        }
        writer.write(";");
    }

    static void generateServiceHandler(SymbolProvider symbolProvider,
                                       Shape serviceShape,
                                       Set<OperationShape> operations,
                                       TypeScriptWriter writer) {
        addCommonHandlerImports(writer);
        writer.addImport("UnknownOperationException", "__UnknownOperationException", "@aws-smithy/server-common");

        Symbol serviceSymbol = symbolProvider.toSymbol(serviceShape);
        Symbol handlerSymbol = serviceSymbol.expectProperty("handler", Symbol.class);
        Symbol operationsType = serviceSymbol.expectProperty("operations", Symbol.class);
        writer.addImport("ServerSerdeContext", null, "@aws-smithy/server-common");

        writeSerdeContextBase(writer);
        writeHandleFunction(writer);

        writer.openBlock("export class $L implements __ServiceHandler {", "}", handlerSymbol.getName(), () -> {
            writer.write("private service: $T;", serviceSymbol);
            writer.write("private mux: __Mux<$S, $T>;", serviceShape.getId().getName(), operationsType);
            writer.write("private serializerFactory: <T extends $T>(operation: T) => "
                            + "__OperationSerializer<$T, T, __SmithyException>;", operationsType, serviceSymbol);
            writer.write("private serializeFrameworkException: (e: __SmithyFrameworkException, "
                            + "ctx: ServerSerdeContext) => Promise<__HttpResponse>;");
            writer.writeDocs(() -> {
                writer.write("Construct a $T handler.", serviceSymbol);
                writer.write("@param service The {@link $1T} implementation that supplies the business logic for $1T",
                        serviceSymbol);
                writer.writeInline("@param mux The {@link __Mux} that determines which service and operation are ");
                writer.write("being invoked by a given {@link __HttpRequest}");
                writer.writeInline("@param serializerFactory A factory for an {@link __OperationSerializer} for each ");
                writer.write("operation in $T that ", serviceSymbol);
                writer.writeInline("                         ")
                      .write("handles deserialization of requests and serialization of responses");
                writer.write("@param serializeFrameworkException A function that can serialize "
                        + "{@link __SmithyFrameworkException}s");
            });
            writer.openBlock("constructor(", ") {", () -> {
                writer.write("service: $T,", serviceSymbol);
                writer.write("mux: __Mux<$S, $T>,", serviceShape.getId().getName(), operationsType);
                writer.write("serializerFactory:<T extends $T>(op: T) => "
                                + "__OperationSerializer<$T, T, __SmithyException>,", operationsType, serviceSymbol);
                writer.write("serializeFrameworkException: (e: __SmithyFrameworkException, ctx: ServerSerdeContext) => "
                        + "Promise<__HttpResponse>");
            });
            writer.indent();
            writer.write("this.service = service;");
            writer.write("this.mux = mux;");
            writer.write("this.serializerFactory = serializerFactory;");
            writer.write("this.serializeFrameworkException = serializeFrameworkException;");
            writer.closeBlock("}");
            writer.openBlock("async handle(request: __HttpRequest): Promise<__HttpResponse> {", "}", () -> {
                writer.write("const target = this.mux.match(request);");
                writer.openBlock("if (target === undefined) {", "}", () -> {
                    writer.write("return this.serializeFrameworkException(new __UnknownOperationException(), "
                            + "serdeContextBase);");
                });
                writer.openBlock("switch (target.operation) {", "}", () -> {
                    for (OperationShape operation : operations) {
                        String opName = operation.getId().getName();
                        writer.openBlock("case $S : {", "}", opName, () -> {
                            writer.write("return handle(request, this.serializerFactory($S), this.service.$L, "
                                    + "this.serializeFrameworkException);",
                                    opName, symbolProvider.toSymbol(operation).getName());
                        });
                    }
                });
            });
        });
    }

    static void generateOperationHandler(SymbolProvider symbolProvider,
                                         Shape serviceShape,
                                         OperationShape operation,
                                         TypeScriptWriter writer) {
        addCommonHandlerImports(writer);

        writeSerdeContextBase(writer);
        writeHandleFunction(writer);

        String operationName = operation.getId().getName();
        Symbol serviceSymbol = symbolProvider.toSymbol(serviceShape);
        Symbol operationSymbol = symbolProvider.toSymbol(operation);

        Symbol inputSymbol = operationSymbol.expectProperty("inputType", Symbol.class);
        Symbol outputSymbol = operationSymbol.expectProperty("outputType", Symbol.class);
        Symbol handlerSymbol = operationSymbol.expectProperty("handler", Symbol.class);
        Symbol errorsSymbol = operationSymbol.expectProperty("errorsType", Symbol.class);
        writer.addImport("ServerSerdeContext", null, "@aws-smithy/server-common");

        writer.openBlock("export class $L implements __ServiceHandler {", "}", handlerSymbol.getName(), () -> {
            writer.write("private operation: __Operation<$T, $T>;", inputSymbol, outputSymbol);
            writer.write("private mux: __Mux<$S, $S>;", serviceShape.getId().getName(), operationName);
            writer.write("private serializer: __OperationSerializer<$T, $S, $T>;",
                    serviceSymbol, operationName, errorsSymbol);
            writer.write("private serializeFrameworkException: (e: __SmithyFrameworkException, "
                    + "ctx: ServerSerdeContext) => Promise<__HttpResponse>;");
            writer.writeDocs(() -> {
                writer.write("Construct a $T handler.", operationSymbol);
                writer.write("@param service The {@link __Operation} implementation that supplies the business "
                                + "logic for $1T", operationSymbol);
                writer.writeInline("@param mux The {@link __Mux} that verifies which service and operation are being ");
                writer.write("invoked by a given {@link __HttpRequest}");
                writer.write("@param serializer An {@link __OperationSerializer} for $T that ", operationSymbol);
                writer.writeInline("                  ")
                        .write("handles deserialization of requests and serialization of responses");
                writer.write("@param serializeFrameworkException A function that can serialize "
                        + "{@link __SmithyFrameworkException}s");
            });
            writer.openBlock("constructor(", ") {", () -> {
                writer.write("operation: __Operation<$T, $T>,", inputSymbol, outputSymbol);
                writer.write("mux: __Mux<$S, $S>,", serviceShape.getId().getName(), operationName);
                writer.write("serializer: __OperationSerializer<$T, $S, $T>,",
                        serviceSymbol, operationName, errorsSymbol);
                writer.write("serializeFrameworkException: (e: __SmithyFrameworkException, ctx: ServerSerdeContext) => "
                        + "Promise<__HttpResponse>");
            });
            writer.indent();
            writer.write("this.operation = operation;");
            writer.write("this.mux = mux;");
            writer.write("this.serializer = serializer;");
            writer.write("this.serializeFrameworkException = serializeFrameworkException;");
            writer.closeBlock("}");
            writer.openBlock("async handle(request: __HttpRequest): Promise<__HttpResponse> {", "}", () -> {
                writer.write("const target = this.mux.match(request);");
                writer.openBlock("if (target === undefined) {", "}", () -> {
                    writer.write("console.log('Received a request that did not match $L.$L. This indicates a "
                            + "misconfiguration.');", serviceShape.getId(), operation.getId().getName());
                    writer.write("return this.serializeFrameworkException(new __InternalFailureException(), "
                            + "serdeContextBase);");
                });
                writer.write("return handle(request, this.serializer, this.operation, "
                        + "this.serializeFrameworkException);");
            });
        });
    }

    private static void addCommonHandlerImports(TypeScriptWriter writer) {
        writer.addImport("Operation", "__Operation", "@aws-smithy/server-common");
        writer.addImport("ServiceHandler", "__ServiceHandler", "@aws-smithy/server-common");
        writer.addImport("Mux", "__Mux", "@aws-smithy/server-common");
        writer.addImport("OperationSerializer", "__OperationSerializer", "@aws-smithy/server-common");
        writer.addImport("InternalFailureException", "__InternalFailureException", "@aws-smithy/server-common");
        writer.addImport("SerializationException", "__SerializationException", "@aws-smithy/server-common");
        writer.addImport("SmithyFrameworkException", "__SmithyFrameworkException", "@aws-smithy/server-common");
        writer.addImport("HttpRequest", "__HttpRequest", "@aws-sdk/protocol-http");
        writer.addImport("HttpResponse", "__HttpResponse", "@aws-sdk/protocol-http");
        writer.addImport("SmithyException", "__SmithyException", "@aws-sdk/smithy-client");
    }

    private static void writeHandleFunction(TypeScriptWriter writer) {
        writer.addImport("Operation", "__Operation", "@aws-smithy/server-common");
        writer.addImport("OperationInput", "__OperationInput", "@aws-smithy/server-common");
        writer.addImport("OperationOutput", "__OperationOutput", "@aws-smithy/server-common");

        writer.openBlock("async function handle<S, O extends keyof S>(", "): Promise<__HttpResponse> {", () -> {
            writer.write("request:__HttpRequest,");
            writer.write("serializer: __OperationSerializer<S, O, __SmithyException>,");
            writer.write("operation: __Operation<__OperationInput<S[O]>, __OperationOutput<S[O]>>,");
            writer.write("serializeFrameworkException: (e: __SmithyFrameworkException, "
                    + "ctx: ServerSerdeContext) => Promise<__HttpResponse>");
        });
        writer.indent();
        writer.write("let input;");
        writer.openBlock("try {", "} catch (error: unknown) {", () -> {
            writer.openBlock("input = await serializer.deserialize(request, {", "});", () -> {
                writer.write("endpoint: () => Promise.resolve(request), ...serdeContextBase");
            });
        });
        writer.indent();
        writer.write("return serializeFrameworkException(new __SerializationException(), "
                + "serdeContextBase);");
        writer.closeBlock("}");
        writer.openBlock("try {", "} catch(error: unknown) {", () -> {
            writer.write("let output = await operation(input, request);");
            writer.write("return serializer.serialize(output, serdeContextBase);");
        });
        writer.indent();
        writer.openBlock("if (serializer.isOperationError(error)) {", "}", () -> {
            writer.write("return serializer.serializeError(error, serdeContextBase);");
        });
        writer.write("console.log('Received an unexpected error', error);");
        writer.write("return serializeFrameworkException(new __InternalFailureException(), "
                + "serdeContextBase);");
        writer.closeBlock("}");
        writer.closeBlock("}");
    }

    private static void writeSerdeContextBase(TypeScriptWriter writer) {
        writer.addImport("SerdeContext", null, "@aws-sdk/types");
        writer.addImport("NodeHttpHandler", null, "@aws-sdk/node-http-handler");
        writer.addImport("streamCollector", null, "@aws-sdk/node-http-handler");
        writer.addImport("fromBase64", null, "@aws-sdk/util-base64-node");
        writer.addImport("toBase64", null, "@aws-sdk/util-base64-node");
        writer.addImport("fromUtf8", null, "@aws-sdk/util-utf8-node");
        writer.addImport("toUtf8", null, "@aws-sdk/util-utf8-node");

        writer.openBlock("const serdeContextBase = {", "};", () -> {
            writer.write("base64Encoder: toBase64,");
            writer.write("base64Decoder: fromBase64,");
            writer.write("utf8Encoder: toUtf8,");
            writer.write("utf8Decoder: fromUtf8,");
            writer.write("streamCollector: streamCollector,");
            writer.write("requestHandler: new NodeHttpHandler(),");
            writer.write("disableHostPrefix: true");
        });
    }

    static void generateServerInterfaces(SymbolProvider symbolProvider,
                                         ServiceShape service,
                                         Set<OperationShape> operations,
                                         TypeScriptWriter writer) {
        writer.addImport("Operation", "__Operation", "@aws-smithy/server-common");

        String serviceInterfaceName = symbolProvider.toSymbol(service).getName();

        writer.openBlock("export interface $L {", "}", serviceInterfaceName, () -> {
            for (OperationShape operation : operations) {
                Symbol symbol = symbolProvider.toSymbol(operation);
                writer.write("$L: $T", symbol.getName(), symbol);
            }
        });
    }
}
