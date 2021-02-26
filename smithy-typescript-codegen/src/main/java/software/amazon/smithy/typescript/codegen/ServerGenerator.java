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

import java.util.LinkedHashSet;
import java.util.Set;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.utils.StringUtils;

final class ServerGenerator {

    private ServerGenerator() {}

    static void generateServiceHandler(ServiceShape service,
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

        String serviceName = StringUtils.capitalize(service.getId().getName());
        String operationsTypeName = serviceName + "Operations";

        writer.addImport(serviceName + "Service", null, ".");
        writer.write("type $L = keyof $L;", operationsTypeName, serviceName + "Service");

        writer.openBlock("export class $LServiceHandler implements ServiceHandler {", "}", serviceName, () -> {
            writer.write("private service: $LService;", serviceName);
            writer.write("private mux: Mux<$S, $L>;", serviceName, operationsTypeName);
            writer.write("private serializers: Record<$1L, OperationSerializer<$2LService, $1L>>;",
                    operationsTypeName, serviceName);
            writer.openBlock("private serdeContextBase = {", "};", () -> {
                writer.write("base64Encoder: toBase64,");
                writer.write("base64Decoder: fromBase64,");
                writer.write("utf8Encoder: toUtf8,");
                writer.write("utf8Decoder: fromUtf8,");
                writer.write("streamCollector: streamCollector,");
                writer.write("requestHandler: new NodeHttpHandler(),");
                writer.write("disableHostPrefix: true");
            });
            writer.write("/**");
            writer.write(" * Construct a $LService handler.", serviceName);
            writer.write(" * @param service The {@link $LService} implementation that supplies", serviceName);
            writer.write(" *                the business logic for $LService", serviceName);
            writer.write(" * @param mux The {@link Mux} that determines which service and operation are being");
            writer.write(" *            invoked by a given {@link HttpRequest}");
            writer.write(" * @param serializers An {@link OperationSerializer} for each operation in");
            writer.write(" *                    $LService that handles deserialization of requests and", serviceName);
            writer.write(" *                    serialization of responses");
            writer.write(" */");
            writer.openBlock("constructor(service: $1LService, "
                            + "mux: Mux<$1S, $2L>, "
                            + "serializers: Record<$2L, OperationSerializer<$1LService, $2L>>) {", "}",
                    serviceName, operationsTypeName, () -> {
                writer.write("this.service = service;");
                writer.write("this.mux = mux;");
                writer.write("this.serializers = serializers;");
            });
            writer.openBlock("async handle(request: HttpRequest): Promise<HttpResponse> {", "}", () -> {
                writer.write("const target = this.mux.match(request);");
                writer.openBlock("if (target === undefined) {", "}", () -> {
                    writer.write("throw new Error(`Could not match any operation to $${request.method} "
                            + "$${request.path} $${JSON.stringify(request.query)}`);");
                });
                writer.openBlock("switch (target.operation) {", "}", () -> {
                    for (OperationShape operation : operations) {
                        generateHandlerCase(writer, serviceName, operation);
                    }
                });
            });
        });
    }

    private static void generateHandlerCase(TypeScriptWriter writer, String serviceName, OperationShape operation) {
        String opName = operation.getId().getName();
        writer.openBlock("case $S : {", "}", opName, () -> {
            writer.write("let serializer = this.serializers.$1L as OperationSerializer<$2LService, $1S>;",
                    opName, serviceName);
            writer.openBlock("let input = await serializer.deserialize(request, {", "});", () -> {
                writer.write("endpoint: () => Promise.resolve(request), ...this.serdeContextBase");
            });
            writer.write("let output = this.service.$L(input, request);", opName);
            writer.write("return serializer.serialize(output, this.serdeContextBase);");
        });
    }

    static void generateServerInterfaces(SymbolProvider symbolProvider,
                                         ServiceShape service,
                                         Set<OperationShape> operations,
                                         TypeScriptWriter writer) {
        writer.addImport("Operation", "__Operation", "@aws-smithy/server-common");

        String serviceInterfaceName = StringUtils.capitalize(service.getId().getName()) + "Service";

        writer.openBlock("export interface $L {", "}", serviceInterfaceName, () -> {
            for (OperationShape operation : operations) {
                Symbol symbol = symbolProvider.toSymbol(operation);
                writer.write("$L: $L<$T, $T>", StringUtils.capitalize(operation.getId().getName()),
                        "__Operation",
                        symbol.expectProperty("inputType", Symbol.class),
                        symbol.expectProperty("outputType", Symbol.class));
            }
        });

        writer.addImport("ParsedRequest", "__ParsedRequest", "@aws-smithy/server-common");
        writer.addImport("PreparedResponse", "__PreparedResponse", "@aws-smithy/server-common");

        Set<String> requestInterfaces = new LinkedHashSet<>();
        Set<String> responseInterfaces = new LinkedHashSet<>();
        for (OperationShape operation : operations) {
            String opName = StringUtils.capitalize(operation.getId().getName());
            String requestInterfaceName = "Parsed" + opName + "Request";
            String responseInterfaceName = "Prepared" + opName + "Response";

            writer.write("export interface $L extends $L<$L, $S> {}",
                    requestInterfaceName, "__ParsedRequest", serviceInterfaceName, opName);
            writer.write("export interface $L extends $L<$L, $S> {}",
                    responseInterfaceName, "__PreparedResponse", serviceInterfaceName, opName);

            requestInterfaces.add(requestInterfaceName);
            responseInterfaces.add(responseInterfaceName);
        }

        writer.write("export type $LRequests = $L;",
                serviceInterfaceName, String.join(" | ", requestInterfaces));

        writer.write("export type $LResponses = $L;",
                serviceInterfaceName, String.join(" | ", responseInterfaces));
    }
}
