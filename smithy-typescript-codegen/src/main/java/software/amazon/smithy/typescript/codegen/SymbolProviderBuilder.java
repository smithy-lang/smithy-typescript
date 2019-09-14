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

import software.amazon.smithy.codegen.core.ReservedWordSymbolProvider;
import software.amazon.smithy.codegen.core.ReservedWords;
import software.amazon.smithy.codegen.core.ReservedWordsBuilder;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.StringUtils;

/**
 * Builds and configures a JavaScript symbol provider.
 *
 * @see TypeScriptCodegenPlugin#symbolProviderBuilder
 */
public final class SymbolProviderBuilder implements SmithyBuilder<SymbolProvider> {

    private static final String MODEL_PROPERTY = "model";
    private static final String TARGET_PROPERTY = "target";

    private Model model;
    private TypeScriptTarget typeScriptTarget;

    SymbolProviderBuilder() {}

    @Override
    public SymbolProvider build() {
        // Ensure the required properties were set.
        SmithyBuilder.requiredState(MODEL_PROPERTY, model);
        SmithyBuilder.requiredState(TARGET_PROPERTY, typeScriptTarget);

        TypeScriptSymbolProvider symbolProvider = new TypeScriptSymbolProvider(model, typeScriptTarget);

        // Load reserved words from a new-line delimited file.
        ReservedWords reservedWords = new ReservedWordsBuilder()
                .loadWords(getClass().getResource("reserved-words.txt")).build();

        return ReservedWordSymbolProvider.builder()
                .nameReservedWords(reservedWords)
                .symbolProvider(symbolProvider)
                // Only escape words when the symbol has a namespace. This
                // prevents escaping intentional references to reserved words.
                .escapePredicate((shape, symbol) -> !StringUtils.isEmpty(symbol.getNamespace()))
                .build();
    }

    /**
     * Sets the required model being used when providing symbols.
     *
     * @param model Model to generate symbols for.
     * @return Returns the builder.
     */
    public SymbolProviderBuilder model(Model model) {
        this.model = model;
        return this;
    }

    /**
     * Sets the required target environment of where the symbols are to be used.
     *
     * @param typeScriptTarget Environment where the symbols are used.
     * @return Returns the builder.
     */
    public SymbolProviderBuilder targetEnvironment(TypeScriptTarget typeScriptTarget) {
        this.typeScriptTarget = typeScriptTarget;
        return this;
    }
}
