/*
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import java.nio.file.Paths;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
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
                            writer.addImport("ServiceException", "__ServiceException",
                                    TypeScriptDependency.AWS_SMITHY_CLIENT);
                            writer.addTypeImport("ServiceExceptionOptions", "__ServiceExceptionOptions",
                                    TypeScriptDependency.AWS_SMITHY_CLIENT);
                            // Export ServiceException information to allow
                            //      documentation inheritance to consume their types
                            writer.write("export type { __ServiceExceptionOptions };\n");
                            writer.write("export { __ServiceException };\n");
                            writer.writeDocs("@public\n\nBase exception class for all service exceptions from "
                                    + serviceName + " service.");
                            writer.openBlock("export class $L extends __ServiceException {", serviceExceptionName);
                            writer.writeDocs("@internal");
                            writer.openBlock("constructor(options: __ServiceExceptionOptions) {");
                            writer.write("super(options);");
                            writer.write("Object.setPrototypeOf(this, $L.prototype);", serviceExceptionName);
                            writer.closeBlock("}"); // constructor
                            writer.closeBlock("}"); // class
                    });
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
     * class is the ServiceException class from server-common package.
     */
    @Override
    public SymbolProvider decorateSymbolProvider(
            Model model,
            TypeScriptSettings settings,
            SymbolProvider symbolProvider
    ) {
        return shape -> {
            Symbol symbol = symbolProvider.toSymbol(shape);
            if (shape.hasTrait(ErrorTrait.class)) {
                String serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
                String baseExceptionAlias = "__BaseException";
                SymbolReference reference;
                if (settings.generateClient()) {
                    String serviceExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, model);
                    String namespace = Paths.get(".", "src", "models", serviceExceptionName).toString();
                    Symbol serviceExceptionSymbol = Symbol.builder()
                            .name(serviceExceptionName)
                            .namespace(namespace, "/")
                            .definitionFile(namespace + ".ts").build();
                    reference = SymbolReference.builder()
                            .options(SymbolReference.ContextOption.USE)
                            .alias(baseExceptionAlias)
                            .symbol(serviceExceptionSymbol)
                            .build();
                } else {
                    reference = SymbolReference.builder()
                            .options(SymbolReference.ContextOption.USE)
                            .alias(baseExceptionAlias)
                            .symbol(TypeScriptDependency.SERVER_COMMON.createSymbol("ServiceException"))
                            .build();
                }
                return symbol.toBuilder().addReference(reference).build();
            }
            return symbol;
        };
    }
}
