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
import java.util.LinkedHashSet;
import java.util.Set;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.utils.StringUtils;

final class ServerGenerator {

    private ServerGenerator() {}

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

        writer.writeInline("export type $LRequests = ", serviceInterfaceName);
        for (Iterator<String> iter = requestInterfaces.iterator(); iter.hasNext();) {
            writer.writeInline(iter.next());
            if (iter.hasNext()) {
                writer.writeInline(" | ");
            }
        }
        writer.write(";");

        writer.writeInline("export type $LResponses = ", serviceInterfaceName);
        for (Iterator<String> iter = responseInterfaces.iterator(); iter.hasNext();) {
            writer.writeInline(iter.next());
            if (iter.hasNext()) {
                writer.writeInline(" | ");
            }
        }
        writer.write(";");
    }
}
