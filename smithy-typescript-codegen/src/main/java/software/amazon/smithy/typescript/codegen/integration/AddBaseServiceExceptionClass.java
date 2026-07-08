/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.integration;

import java.nio.file.Paths;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenContext;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generate the base ServiceException class.
 */
@SmithyInternalApi
public final class AddBaseServiceExceptionClass implements TypeScriptIntegration {

    @Override
    public void customize(TypeScriptCodegenContext codegenContext) {
        TypeScriptSettings settings = codegenContext.settings();
        Model model = codegenContext.model();
        SymbolProvider symbolProvider = codegenContext.symbolProvider();
        BiConsumer<String, Consumer<TypeScriptWriter>> writerFactory = codegenContext.writerDelegator()::useFileWriter;

        writeAdditionalFiles(settings, model, symbolProvider, writerFactory);

        writerFactory.accept(Paths.get(CodegenUtils.SOURCE_FOLDER, "index.ts").toString(), writer -> {
            writeAdditionalExports(settings, model, symbolProvider, writer);
        });
    }

    private void writeAdditionalFiles(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        BiConsumer<String, Consumer<TypeScriptWriter>> writerFactory
    ) {
        boolean isClientSdk = settings.generateClient();
        if (isClientSdk) {
            String serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
            String serviceExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, model);
            writerFactory.accept(
                Paths.get(CodegenUtils.SOURCE_FOLDER, "models", serviceExceptionName + ".ts").toString(),
                writer -> {
                    writer.addImportSubmodule(
                        "ServiceException",
                        "__ServiceException",
                        TypeScriptDependency.SMITHY_CORE,
                        SmithyCoreSubmodules.CLIENT
                    );
                    writer.addTypeImportSubmodule(
                        "ServiceExceptionOptions",
                        "__ServiceExceptionOptions",
                        TypeScriptDependency.SMITHY_CORE,
                        SmithyCoreSubmodules.CLIENT
                    );
                    // Export ServiceException information to allow
                    //      documentation inheritance to consume their types
                    writer.write("export type { __ServiceExceptionOptions };\n");
                    writer.write("export { __ServiceException };\n");
                    writer.writeDocs(
                        "@public\n\nBase exception class for all service exceptions from " + serviceName
                            + " service."
                    );
                    writer.openBlock("export class $L extends __ServiceException {", serviceExceptionName);
                    writer.writeDocs("@internal");
                    writer.openBlock("constructor(options: __ServiceExceptionOptions) {");
                    writer.write("super(options);");
                    writer.write("Object.setPrototypeOf(this, $L.prototype);", serviceExceptionName);
                    writer.closeBlock("}"); // constructor
                    writer.closeBlock("}"); // class
                }
            );
        }
    }

    private void writeAdditionalExports(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer
    ) {
        boolean isClientSdk = settings.generateClient();
        if (isClientSdk) {
            String serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
            String serviceExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, model);
            writer.write("export { $1L } from \"./models/$1L\";", serviceExceptionName);
        }
    }

    /**
     * For any error shape, add the reference of the base error class to the
     * error symbol's references. In client SDK, the base error class is the
     * service-specific service exception class. In server SDK, the base error
     * class is the ServiceException class from server-common package. In
     * types-only mode there is no service, so error shapes extend the generic
     * {@code ServiceException} base from {@code @smithy/core}.
     */
    @Override
    public SymbolProvider decorateSymbolProvider(
        Model model,
        TypeScriptSettings settings,
        SymbolProvider symbolProvider
    ) {
        return shape -> {
            Symbol symbol = symbolProvider.toSymbol(shape);
            if (!shape.hasTrait(ErrorTrait.class)) {
                return symbol;
            }
            String baseExceptionAlias = "__BaseException";
            Symbol baseExceptionSymbol;
            if (settings.getOptionalService().isEmpty()) {
                // Types-only mode: no service-specific base exists, so reference the generic
                // ServiceException from the @smithy/core client submodule.
                baseExceptionSymbol = Symbol.builder()
                    .name("ServiceException")
                    .namespace(TypeScriptDependency.SMITHY_CORE.getPackageName() + SmithyCoreSubmodules.CLIENT, "/")
                    .addDependency(TypeScriptDependency.SMITHY_CORE)
                    .build();
            } else if (settings.generateClient()) {
                String serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
                String serviceExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, model);
                String namespace = Paths.get(".", "src", "models", serviceExceptionName).toString();
                baseExceptionSymbol = Symbol.builder()
                    .name(serviceExceptionName)
                    .namespace(namespace, "/")
                    .definitionFile(namespace + ".ts")
                    .build();
            } else {
                baseExceptionSymbol = TypeScriptDependency.SERVER_COMMON.createSymbol("ServiceException");
            }
            SymbolReference reference = SymbolReference.builder()
                .options(SymbolReference.ContextOption.USE)
                .alias(baseExceptionAlias)
                .symbol(baseExceptionSymbol)
                .build();
            return symbol.toBuilder().addReference(reference).build();
        };
    }
}
