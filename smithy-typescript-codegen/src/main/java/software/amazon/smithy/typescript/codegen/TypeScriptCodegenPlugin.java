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

import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.build.SmithyBuildPlugin;
import software.amazon.smithy.codegen.core.ReservedWordSymbolProvider;
import software.amazon.smithy.codegen.core.ReservedWords;
import software.amazon.smithy.codegen.core.ReservedWordsBuilder;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.utils.StringUtils;

/**
 * Plugin to trigger TypeScript code generation.
 */
public final class TypeScriptCodegenPlugin implements SmithyBuildPlugin {

    @Override
    public String getName() {
        return "typescript-codegen";
    }

    @Override
    public void execute(PluginContext context) {
        new CodegenVisitor(context).execute();
    }

    /**
     * Creates a TypeScript symbol provider.
     *
     * @param model Model to generate symbols for.
     * @return Returns the created provider.
     */
    public static SymbolProvider createSymbolProvider(Model model) {
        return createSymbolProvider(model, null, null);
    }

    /**
     * Creates a TypeScript symbol provider.
     *
     * @param model Model to generate symbols for.
     * @param rootNamespace The namespace that is the root of the shaded target namespace.
     * @param targetNamespace The namespace to shade all ShapeIds into.
     * @return Returns the created provider.
     */
    public static SymbolProvider createSymbolProvider(Model model, String rootNamespace, String targetNamespace) {
        SymbolVisitor symbolProvider = new SymbolVisitor(model, rootNamespace, targetNamespace);

        // Load reserved words from a new-line delimited file.
        ReservedWords reservedWords = new ReservedWordsBuilder()
                .loadWords(TypeScriptCodegenPlugin.class.getResource("reserved-words.txt"))
                .build();

        return ReservedWordSymbolProvider.builder()
                .nameReservedWords(reservedWords)
                .symbolProvider(symbolProvider)
                // Only escape words when the symbol has a namespace. This
                // prevents escaping intentional references to reserved words.
                .escapePredicate((shape, symbol) -> !StringUtils.isEmpty(symbol.getNamespace()))
                .build();
    }
}
