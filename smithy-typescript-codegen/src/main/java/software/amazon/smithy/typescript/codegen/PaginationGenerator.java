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

import java.nio.file.Paths;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.PaginatedIndex;
import software.amazon.smithy.model.knowledge.PaginationInfo;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
final class PaginationGenerator implements Runnable {

    static final String PAGINATION_FOLDER = "pagination";
    static final String PAGINATION_INTERFACE_FILE =
        Paths.get(CodegenUtils.SOURCE_FOLDER, PAGINATION_FOLDER, "Interfaces.ts").toString();

    private final TypeScriptWriter writer;
    private final PaginationInfo paginatedInfo;

    private final Symbol serviceSymbol;
    private final Symbol operationSymbol;
    private final Symbol inputSymbol;
    private final Symbol outputSymbol;

    private final String operationName;
    private final String methodName;
    private final String aggregatedClientName;
    private final String paginationType;

    PaginationGenerator(
            Model model,
            ServiceShape service,
            OperationShape operation,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            String aggregatedClientName
    ) {

        this.writer = writer;

        this.serviceSymbol = symbolProvider.toSymbol(service);
        this.operationSymbol = symbolProvider.toSymbol(operation);
        this.inputSymbol = symbolProvider.toSymbol(operation).expectProperty("inputType", Symbol.class);
        this.outputSymbol = symbolProvider.toSymbol(operation).expectProperty("outputType", Symbol.class);

        this.operationName = operation.getId().getName();
        this.aggregatedClientName = aggregatedClientName;

        // e.g. listObjects
        this.methodName = Character.toLowerCase(operationName.charAt(0)) + operationName.substring(1);
        this.paginationType = this.aggregatedClientName + "PaginationConfiguration";

        PaginatedIndex paginatedIndex = PaginatedIndex.of(model);
        Optional<PaginationInfo> paginationInfo = paginatedIndex.getPaginationInfo(service, operation);
        this.paginatedInfo = paginationInfo.orElseThrow(() -> {
            return new CodegenException("Expected Paginator to have pagination information.");
        });
    }

    @Override
    public void run() {
        // Import Service Types
        writer.addRelativeImport(operationSymbol.getName(),
                operationSymbol.getName(),
                Paths.get(".", operationSymbol.getNamespace()));
        writer.addRelativeImport(inputSymbol.getName(),
                inputSymbol.getName(),
                Paths.get(".", inputSymbol.getNamespace()));
        writer.addRelativeImport(outputSymbol.getName(),
                outputSymbol.getName(),
                Paths.get(".", outputSymbol.getNamespace()));
        writer.addRelativeImport(serviceSymbol.getName(), serviceSymbol.getName(),
                Paths.get(".", serviceSymbol.getNamespace()));

        // Import Pagination types
        writer.addImport("Paginator", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addRelativeImport(paginationType, paginationType,
            Paths.get(".", PAGINATION_INTERFACE_FILE.replace(".ts", "")));

        writeCommandRequest();
        writePager();
    }

    static String getOutputFilelocation(OperationShape operation) {
        return Paths.get(CodegenUtils.SOURCE_FOLDER, PAGINATION_FOLDER,
                operation.getId().getName() + "Paginator.ts").toString();
    }

    static void generateServicePaginationInterfaces(
            String aggregatedClientName,
            Symbol service,
            TypeScriptWriter writer
    ) {
        writer.addImport("PaginationConfiguration", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addRelativeImport(service.getName(), service.getName(), Paths.get(".", service.getNamespace()));
        writer.writeDocs("@public")
            .openBlock("export interface $LPaginationConfiguration extends PaginationConfiguration {",
                "}", aggregatedClientName, () -> {
            writer.write("client: $L;", service.getName());
        });
    }

    private static String getModulePath(String fileLocation) {
        return fileLocation.substring(
            fileLocation.lastIndexOf("/") + 1,
            fileLocation.length()
        ).replace(".ts", "");
    }

    static void writeIndex(
            Model model,
            ServiceShape service,
            FileManifest fileManifest
    ) {
        TypeScriptWriter writer = new TypeScriptWriter("");
        writer.write("export * from \"./$L\"", getModulePath(PAGINATION_INTERFACE_FILE));

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(service));
        for (OperationShape operation : containedOperations) {
            if (operation.hasTrait(PaginatedTrait.ID)) {
                String outputFilepath = PaginationGenerator.getOutputFilelocation(operation);
                writer.write("export * from \"./$L\"", getModulePath(outputFilepath));
            }
        }

        fileManifest.writeFile(
            Paths.get(CodegenUtils.SOURCE_FOLDER, PAGINATION_FOLDER, "index.ts").toString(),
            writer.toString());
    }

    private String destructurePath(String path) {
        return "."  + path.replace(".", "!.");
    }

    private void writePager() {
        String serviceTypeName = serviceSymbol.getName();
        String inputTypeName = inputSymbol.getName();
        String outputTypeName = outputSymbol.getName();

        String inputTokenName = paginatedInfo.getPaginatedTrait().getInputToken().get();
        String outputTokenName = paginatedInfo.getPaginatedTrait().getOutputToken().get();

        writer.writeDocs("@public")
            .openBlock(
                "export async function* paginate$L(config: $L, input: $L, ...additionalArguments: any): Paginator<$L>{",
                "}",  operationName, paginationType, inputTypeName, outputTypeName, () -> {
            String destructuredInputTokenName = destructurePath(inputTokenName);
            writer.write("// ToDo: replace with actual type instead of typeof input$L", destructuredInputTokenName);
            writer.write("let token: typeof input$L | undefined = config.startingToken || undefined;",
                    destructuredInputTokenName);

            writer.write("let hasNext = true;");
            writer.write("let page: $L;", outputTypeName);
            writer.openBlock("while (hasNext) {", "}", () -> {
                writer.write("input$L = token;", destructuredInputTokenName);

                if (paginatedInfo.getPageSizeMember().isPresent()) {
                    String pageSize = paginatedInfo.getPageSizeMember().get().getMemberName();
                    writer.write("input[$S] = config.pageSize;", pageSize);
                }

                writer.openBlock("if (config.client instanceof $L) {", "}", serviceTypeName, () -> {
                    writer.write("page = await makePagedClientRequest(config.client, input, ...additionalArguments);");
                });
                writer.openBlock("else {", "}", () -> {
                    writer.write("throw new Error(\"Invalid client, expected $L | $L\");",
                            aggregatedClientName, serviceTypeName);
                });

                writer.write("yield page;");
                writer.write("const prevToken = token;");
                writer.write("token = page$L;", destructurePath(outputTokenName));
                writer.write("hasNext = !!(token && (!config.stopOnSameToken || token !== prevToken));");
            });

            writer.write("// @ts-ignore");
            writer.write("return undefined;");
        });
    }


    /**
     * Paginated command that calls CommandClient().send({...}) under the hood. This is meant for client side (browser)
     * environments and does not generally expose the entire service.
     */
    private void writeCommandRequest() {
        writer.writeDocs("@internal");
        writer.openBlock(
                "const makePagedClientRequest = async (client: $L, input: $L, ...args: any): Promise<$L> => {",
                "}", serviceSymbol.getName(), inputSymbol.getName(),
                outputSymbol.getName(), () -> {
            writer.write("// @ts-ignore");
            writer.write("return await client.send(new $L(input), ...args);", operationSymbol.getName());
        });
    }
}
