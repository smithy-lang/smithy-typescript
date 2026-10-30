/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.nio.file.Paths;
import java.util.List;
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
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
final class PaginationGenerator implements Runnable {

    static final String PAGINATION_FOLDER = "pagination";
    static final String PAGINATION_INTERFACE_FILE = Paths.get(
        CodegenUtils.SOURCE_FOLDER,
        PAGINATION_FOLDER,
        "Interfaces.ts"
    ).toString();

    private final Model model;
    private final SymbolProvider symbolProvider;
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
        this.model = model;
        this.symbolProvider = symbolProvider;
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
        writer.addRelativeImport(
            operationSymbol.getName(),
            operationSymbol.getName(),
            Paths.get(".", operationSymbol.getNamespace())
        );
        writer.addRelativeImport(
            inputSymbol.getName(),
            inputSymbol.getName(),
            Paths.get(".", inputSymbol.getNamespace())
        );
        writer.addRelativeImport(
            outputSymbol.getName(),
            outputSymbol.getName(),
            Paths.get(".", outputSymbol.getNamespace())
        );
        writer.addRelativeImport(
            serviceSymbol.getName(),
            serviceSymbol.getName(),
            Paths.get(".", serviceSymbol.getNamespace())
        );

        // Import Pagination types
        writer.addTypeImport("Paginator", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addRelativeTypeImport(
            paginationType,
            paginationType,
            Paths.get(".", PAGINATION_INTERFACE_FILE.replace(".ts", ""))
        );

        writePager();
        writeItemsPager();
    }

    static String getOutputFileLocation(OperationShape operation) {
        return Paths.get(
            CodegenUtils.SOURCE_FOLDER,
            PAGINATION_FOLDER,
            operation.getId().getName() + "Paginator.ts"
        ).toString();
    }

    static void generateServicePaginationInterfaces(
        String aggregatedClientName,
        Symbol service,
        TypeScriptWriter writer
    ) {
        writer.addTypeImport("PaginationConfiguration", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addRelativeImport(service.getName(), service.getName(), Paths.get(".", service.getNamespace()));
        writer
            .writeDocs("@public")
            .openBlock(
                "export interface $LPaginationConfiguration extends PaginationConfiguration {",
                "}",
                aggregatedClientName,
                () -> {
                    writer.write("client: $L;", service.getName());
                }
            );
    }

    private static String getModulePath(String fileLocation) {
        return fileLocation.substring(fileLocation.lastIndexOf("/") + 1, fileLocation.length()).replace(".ts", "");
    }

    static void writeIndex(Model model, ServiceShape service, FileManifest fileManifest) {
        TypeScriptWriter writer = new TypeScriptWriter("");
        writer.write("export * from \"./$L\";", getModulePath(PAGINATION_INTERFACE_FILE));

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(service));
        for (OperationShape operation : containedOperations) {
            if (operation.hasTrait(PaginatedTrait.ID)) {
                String outputFilepath = PaginationGenerator.getOutputFileLocation(operation);
                writer.write("export * from \"./$L\";", getModulePath(outputFilepath));
            }
        }

        fileManifest.writeFile(
            Paths.get(CodegenUtils.SOURCE_FOLDER, PAGINATION_FOLDER, "index.ts").toString(),
            writer.toString()
        );
    }

    private void writePager() {
        String serviceTypeName = serviceSymbol.getName();
        String inputTypeName = inputSymbol.getName();
        String outputTypeName = outputSymbol.getName();

        String inputTokenName = paginatedInfo.getPaginatedTrait().getInputToken().get();
        String outputTokenName = paginatedInfo.getPaginatedTrait().getOutputToken().get();

        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
        writer.addImport("createPaginator", null, TypeScriptDependency.SMITHY_CORE);

        writer.writeDocs("@public");

        writer
            .pushState()
            .putContext("operation", operationName)
            .putContext("aggClient", aggregatedClientName)
            .putContext("inputType", inputTypeName)
            .putContext("outputType", outputTypeName)
            .putContext("paginationType", paginationType)
            .putContext("serviceTypeName", serviceTypeName)
            .putContext("operationName", operationSymbol.getName())
            .putContext("inputToken", inputTokenName)
            .putContext("outputToken", outputTokenName)
            .putContext(
                "pageSizeMember",
                paginatedInfo.getPageSizeMember().map(MemberShape::getMemberName).orElse("")
            )
            .write(
                """
                export const paginate${operation:L}: (
                  config: ${aggClient:L}PaginationConfiguration,
                  input: ${inputType:L},
                  ...rest: any[]
                ) => Paginator<${outputType:L}> = createPaginator<
                  ${paginationType:L},
                  ${inputType:L},
                  ${outputType:L}
                >(${serviceTypeName:L}, ${operationName:L}, ${inputToken:S}, ${outputToken:S}, ${pageSizeMember:S});
                """
            )
            .popState();
    }

    /**
     * Emits an item-level paginator (paginate{Operation}Items) when the @paginated
     * trait declares an items member. It wraps the page paginator and yields items.
     */
    private void writeItemsPager() {
        List<MemberShape> itemsPath = paginatedInfo.getItemsMemberPath();
        if (itemsPath.isEmpty()) {
            return;
        }

        String itemsPathString = paginatedInfo.getPaginatedTrait().getItems().get();
        String itemType = resolveItemType(itemsPath.get(itemsPath.size() - 1));

        writer.addImport("createItemsPaginator", null, TypeScriptDependency.SMITHY_CORE);

        writer.writeDocs("@public");
        writer
            .pushState()
            .putContext("operation", operationName)
            .putContext("aggClient", aggregatedClientName)
            .putContext("inputType", inputSymbol.getName())
            .putContext("paginationType", paginationType)
            .putContext("itemType", itemType)
            .putContext("pagePaginator", "paginate" + operationName)
            .putContext("itemsPath", itemsPathString)
            .write(
                """
                export const paginate${operation:L}Items: (
                  config: ${aggClient:L}PaginationConfiguration,
                  input: ${inputType:L},
                  ...rest: any[]
                ) => Paginator<${itemType:L}> = createItemsPaginator<
                  ${paginationType:L},
                  ${inputType:L},
                  ${itemType:L}
                >(${pagePaginator:L}, ${itemsPath:S});
                """
            )
            .popState();
    }

    /**
     * Resolves the TypeScript item type for the paginated items member.
     * List/set -> element type; map -> [keyType, valueType] tuple. Any other target should be a modeling error.
     */
    private String resolveItemType(MemberShape itemsMember) {
        Shape target = model.expectShape(itemsMember.getTarget());
        if (target instanceof CollectionShape) {
            MemberShape element = ((CollectionShape) target).getMember();
            return writer.format("$T", symbolProvider.toSymbol(element));
        }
        if (target instanceof MapShape) {
            MapShape map = (MapShape) target;
            return writer.format(
                "[$T, $T]",
                symbolProvider.toSymbol(map.getKey()),
                symbolProvider.toSymbol(map.getValue())
            );
        }
        throw new CodegenException(
            String.format(
                "Paginated items member %s of operation %s must target a list or map shape.",
                itemsMember.getId(),
                operationName
            )
        );
    }
}
