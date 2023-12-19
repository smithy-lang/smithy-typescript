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
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
final class PaginationGenerator implements Runnable {

    static final String PAGINATION_FOLDER = "pagination";
    static final String PAGINATION_INTERFACE_FILE =
        Paths.get(CodegenUtils.SOURCE_FOLDER, PAGINATION_FOLDER, "Interfaces.ts").toString();

    private final TypeScriptWriter writer;
    private final String aggregatedClientName;
    private final PaginationInfo paginatedInfo;

    private final Symbol serviceSymbol;
    private final Symbol operationSymbol;
    private final Symbol inputSymbol;
    private final Symbol outputSymbol;

    private final String operationName;
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
        this.aggregatedClientName = aggregatedClientName;

        this.serviceSymbol = symbolProvider.toSymbol(service);
        this.operationSymbol = symbolProvider.toSymbol(operation);
        this.inputSymbol = symbolProvider.toSymbol(operation).expectProperty("inputType", Symbol.class);
        this.outputSymbol = symbolProvider.toSymbol(operation).expectProperty("outputType", Symbol.class);

        this.operationName = operation.getId().getName();

        this.paginationType = aggregatedClientName + "PaginationConfiguration";

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

    private void writePager() {
        String serviceTypeName = serviceSymbol.getName();
        String inputTypeName = inputSymbol.getName();
        String outputTypeName = outputSymbol.getName();

        String inputTokenName = paginatedInfo.getPaginatedTrait().getInputToken().get();
        String outputTokenName = paginatedInfo.getPaginatedTrait().getOutputToken().get();

        writer.addImport("createPaginator", null, TypeScriptDependency.SMITHY_CORE);

        writer.writeDocs("@public");

        writer
            .pushState()
            .putContext(MapUtils.of(
                "operation", operationName,
                "aggClient", aggregatedClientName,
                "inputType", inputTypeName,
                "outputType", outputTypeName,
                "paginationType", paginationType,

                "serviceTypeName", serviceTypeName,
                "operationName", operationSymbol.getName(),
                "inputToken", inputTokenName,
                "outputToken", outputTokenName,
                "pageSizeMember", paginatedInfo.getPageSizeMember().map(MemberShape::getMemberName).orElse("")
            ))
            .write(
                """
                export const paginate$operation:L: (
                    config: $aggClient:LPaginationConfiguration,
                    input: $inputType:L,
                    ...rest: any[]
                ) => Paginator<$outputType:L> =
                    createPaginator<$paginationType:L, $inputType:L, $outputType:L>(
                        $serviceTypeName:L,
                        $operationName:L,
                        $inputToken:S,
                        $outputToken:S,
                        $pageSizeMember:S
                    );
                """
            )
            .popState();
    }
}
