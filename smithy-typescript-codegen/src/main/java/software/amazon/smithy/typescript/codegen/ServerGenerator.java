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
        writer.addImport("ServiceHandler", null, "@aws-smithy/server-common");
        writer.addImport("Mux", null, "@aws-smithy/server-common");
        writer.addImport("OperationSerializer", null, "@aws-smithy/server-common");
        writer.addImport("NodeHttpHandler", null, "@aws-sdk/node-http-handler");
        writer.addImport("streamCollector", null, "@aws-sdk/node-http-handler");
        writer.addImport("fromBase64", null, "@aws-sdk/util-base64-node");
        writer.addImport("toBase64", null, "@aws-sdk/util-base64-node");
        writer.addImport("fromUtf8", null, "@aws-sdk/util-utf8-node");
        writer.addImport("toUtf8", null, "@aws-sdk/util-utf8-node");
        writer.addImport("HttpRequest", null, "@aws-sdk/protocol-http");
        writer.addImport("HttpResponse", null, "@aws-sdk/protocol-http");
        writer.addImport("SmithyException", null, "@aws-sdk/smithy-client");

        Symbol serviceSymbol = symbolProvider.toSymbol(serviceShape);
        Symbol handlerSymbol = serviceSymbol.expectProperty("handler", Symbol.class);
        Symbol operationsType = serviceSymbol.expectProperty("operations", Symbol.class);

        writer.openBlock("export class $L implements ServiceHandler {", "}", handlerSymbol.getName(), () -> {
            writer.write("private service: $T;", serviceSymbol);
            writer.write("private mux: Mux<$S, $T>;", serviceShape.getId().getName(), operationsType);
            writer.write("private serializerFactory: <T extends $T>(operation: T) => "
                            + "OperationSerializer<$T, T, SmithyException>;", operationsType, serviceSymbol);
            writer.openBlock("private serdeContextBase = {", "};", () -> {
                writer.write("base64Encoder: toBase64,");
                writer.write("base64Decoder: fromBase64,");
                writer.write("utf8Encoder: toUtf8,");
                writer.write("utf8Decoder: fromUtf8,");
                writer.write("streamCollector: streamCollector,");
                writer.write("requestHandler: new NodeHttpHandler(),");
                writer.write("disableHostPrefix: true");
            });
            writer.writeDocs(() -> {
                writer.write("Construct a $T handler.", serviceSymbol);
                writer.write("@param service The {@link $1T} implementation that supplies the business logic for $1T",
                        serviceSymbol);
                writer.writeInline("@param mux The {@link Mux} that determines which service and operation are being ");
                writer.write("invoked by a given {@link HttpRequest}");
                writer.writeInline("@param serializerFactory A factory for an {@link OperationSerializer} for each ");
                writer.write("operation in $T that ", serviceSymbol);
                writer.writeInline("                         ")
                      .write("handles deserialization of requests and serialization of responses");
            });
            writer.openBlock("constructor(service: $1T, "
                            + "mux: Mux<$3S, $2T>, "
                            + "serializerFactory: <T extends $2T>(op: T) => "
                            + "OperationSerializer<$1T, T, SmithyException>) {", "}",
                    serviceSymbol, operationsType, serviceShape.getId().getName(), () -> {
                writer.write("this.service = service;");
                writer.write("this.mux = mux;");
                writer.write("this.serializerFactory = serializerFactory;");
            });
            writer.openBlock("async handle(request: HttpRequest): Promise<HttpResponse> {", "}", () -> {
                writer.write("const target = this.mux.match(request);");
                writer.openBlock("if (target === undefined) {", "}", () -> {
                    writer.write("throw new Error(`Could not match any operation to $${request.method} "
                            + "$${request.path} $${JSON.stringify(request.query)}`);");
                });
                writer.openBlock("switch (target.operation) {", "}", () -> {
                    for (OperationShape operation : operations) {
                        generateHandlerCase(writer, serviceSymbol, operation, symbolProvider.toSymbol(operation));
                    }
                });
            });
        });
    }

    private static void generateHandlerCase(TypeScriptWriter writer,
                                            Symbol serviceSymbol,
                                            Shape operationShape,
                                            Symbol operationSymbol) {
        String opName = operationShape.getId().getName();
        writer.openBlock("case $S : {", "}", opName, () -> {
            writer.write("let serializer = this.serializerFactory($S);", opName);
            writer.openBlock("let input = await serializer.deserialize(request, {", "});", () -> {
                writer.write("endpoint: () => Promise.resolve(request), ...this.serdeContextBase");
            });
            writer.write("let output = this.service.$L(input, request);", operationSymbol.getName());
            writer.write("return serializer.serialize(output, this.serdeContextBase);");
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
