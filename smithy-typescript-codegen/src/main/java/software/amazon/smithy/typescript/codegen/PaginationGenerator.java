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


package software.amazon.smithy.typescript.codegen;

import java.util.Optional;

import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.PaginatedIndex;
import software.amazon.smithy.model.knowledge.PaginationInfo;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;

final class PaginationGenerator implements Runnable {

    private final TypeScriptWriter writer;
    private final PaginationInfo paginatedInfo;

    private Symbol serviceSymbol;
    private Symbol operationSymbol;
    private Symbol inputSymbol;
    private Symbol outputSymbol;

    private String methodName;
    private String nonModularServiceName;
    private String paginationType;
    private String interfaceLocation;

    PaginationGenerator(
            Model model,
            ServiceShape service,
            OperationShape operation,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            String nonModularServiceName
    ) {

        this.writer = writer;

        this.serviceSymbol = symbolProvider.toSymbol(service);
        this.operationSymbol = symbolProvider.toSymbol(operation);
        this.inputSymbol = symbolProvider.toSymbol(operation).expectProperty("inputType", Symbol.class);
        this.outputSymbol = symbolProvider.toSymbol(operation).expectProperty("outputType", Symbol.class);

        String operationName = operation.getId().getName();
        this.nonModularServiceName = nonModularServiceName;
        this.methodName = Character.toLowerCase(operationName.charAt(0))
                + operationName.substring(1); // e.g. listObjects
        this.paginationType = this.nonModularServiceName + "PaginationConfiguration";
        this.interfaceLocation = PaginationGenerator.getInterfaceFilelocation();

        PaginatedIndex paginatedModel = model.getKnowledge(PaginatedIndex.class);
        Optional<PaginationInfo> paginationInfo = paginatedModel.getPaginationInfo(service, operation);
        this.paginatedInfo = paginationInfo.orElseThrow(() -> {
            return new CodegenException("Expected Paginator to have pagination information.");
        });
    }

    @Override
    public void run() {
        // Import Service Types
        writer.addImport(this.operationSymbol.getName(),
                this.operationSymbol.getName(),
                this.operationSymbol.getNamespace());
        writer.addImport(this.inputSymbol.getName(),
                this.inputSymbol.getName(),
                this.inputSymbol.getNamespace());
        writer.addImport(this.outputSymbol.getName(),
                this.outputSymbol.getName(),
                this.outputSymbol.getNamespace());
        String nonModularLocation = this.serviceSymbol.getNamespace()
                .replace(this.serviceSymbol.getName(), this.nonModularServiceName);
        writer.addImport(this.nonModularServiceName,
                this.nonModularServiceName,
                nonModularLocation);
        writer.addImport(this.serviceSymbol.getName(), this.serviceSymbol.getName(), this.serviceSymbol.getNamespace());

        // Import Pagination types
        writer.addImport("Paginator", "Paginator", "@aws-sdk/types");
        writer.addImport(this.paginationType, this.paginationType, "./" + this.interfaceLocation.replace(".ts", ""));

        this.writeClientSideRequest();
        this.writeRequest();
        this.writePager();
    }

    static String getOutputFilelocation(OperationShape operation) {
        return "pagination/" + operation.getId().getName() + "Paginator.ts";
    }

    static String getInterfaceFilelocation() {
        return "pagination/Interfaces.ts";
    }

    static void generateServicePaginationInterfaces(String nonModularServiceName,
                                                           Symbol service,
                                                           TypeScriptWriter writer) {
        writer.addImport("PaginationConfiguration", "PaginationConfiguration", "@aws-sdk/types");
        String nonModularLocation = service.getNamespace().replace(service.getName(), nonModularServiceName);
        writer.addImport(nonModularServiceName, nonModularServiceName, nonModularLocation);
        writer.addImport(service.getName(), service.getName(), service.getNamespace());

        writer.openBlock("export interface $LPaginationConfiguration extends PaginationConfiguration {",
                "}", nonModularServiceName, () -> {
            writer.write("client: $L | $L;", nonModularServiceName, service.getName());
        });
    }

    private void writePager() {
        writer.openBlock(
                "export async function* $LPaginate(config: $L, input: $L, ...additionalArguments: any): Paginator<$L>{",
                "}",  this.methodName, this.paginationType,
                this.inputSymbol.getName(), this.outputSymbol.getName(), () -> {
            writer.write("let token: string | undefined = config.startingToken || '';");

            writer.write("let hasNext = true;");
            writer.write("let page:$L;", this.outputSymbol.getName());
            writer.openBlock("while (hasNext) {", "}", () -> {
                writer.write("input[\"$L\"] = token;", this.paginatedInfo.getInputTokenMember().getMemberName());
                if (this.paginatedInfo.getPageSizeMember().isPresent()) {
                    String pageSize = this.paginatedInfo.getPageSizeMember().get().getMemberName();
                    writer.write("input[\"$L\"] = config.pageSize;", pageSize);
                }

                writer.openBlock("if (config.client instanceof $L) {", "}", this.nonModularServiceName, () -> {
                    writer.write("page = await makePagedRequest(config.client, input, ...additionalArguments);");
                });
                writer.openBlock("else if (config.client instanceof $L) {", "}", this.serviceSymbol.getName(), () -> {
                    writer.write(" page = await makePagedClientRequest(config.client, input, ...additionalArguments);");
                });
                writer.openBlock("else {", "}", () -> {
                    writer.write(" throw new Error(\"Invalid client, expected $L | $L\");",
                            this.nonModularServiceName, this.serviceSymbol.getName());
                });

                writer.write("yield page;");
                if (this.paginatedInfo.getOutputTokenMember().getMemberName().contains(".")) {
                    // Smithy allows one level indexing (ex. 'bucket.outputToken').
                    String[] outputIndex = this.paginatedInfo.getOutputTokenMember().getMemberName().split("\\.");
                    writer.write("token = page[\"$L\"][\"$L\"];", outputIndex[0], outputIndex[1]);

                } else {
                    writer.write("token = page[\"$L\"];", paginatedInfo.getOutputTokenMember().getMemberName());
                }

                writer.write("hasNext = !!(token);");
            });

            writer.write("// @ts-ignore");
            writer.write("return undefined;");
        });
    }


    /**
     * Paginated command that calls Command({...}) under the hood. This is meant for server side environments and
     * exposes the entire service.
     */
    private void writeRequest() {
        writer.openBlock(
                "const makePagedRequest = async (client: $L, input: $L, ...args: any): Promise<$L> => {",
                "}", this.nonModularServiceName, this.inputSymbol.getName(),
                this.outputSymbol.getName(), () -> {
            writer.write("// @ts-ignore");
            writer.write("return await client.$L(input, ...args);", this.methodName);
        });
    }

    /**
     * Paginated command that calls CommandClient().send({...}) under the hood. This is meant for client side (browser)
     * environments and does not generally expose the entire service.
     */
    private void writeClientSideRequest() {
        writer.openBlock(
                "const makePagedClientRequest = async (client: $L, input: $L, ...args: any): Promise<$L> => {",
                "}", this.serviceSymbol.getName(), this.inputSymbol.getName(),
                this.outputSymbol.getName(), () -> {
            writer.write("// @ts-ignore");
            writer.write("return await client.send(new $L(input, ...args));",
                    this.operationSymbol.getName());
        });
    }
}
