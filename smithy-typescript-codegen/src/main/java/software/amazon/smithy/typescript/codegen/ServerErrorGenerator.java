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

import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.ErrorTrait;

/**
 * Generates convenience error types for servers, since service developers will throw a modeled exception directly,
 * while clients typically care only about catching them.
 */
final class ServerErrorGenerator implements Runnable {

    private final TypeScriptSettings settings;
    private final Model model;
    private final StructureShape errorShape;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;

    ServerErrorGenerator(TypeScriptSettings settings,
                         Model model,
                         StructureShape errorShape,
                         SymbolProvider symbolProvider,
                         TypeScriptWriter writer) {
        this.settings = settings;
        this.model = model;
        this.errorShape = errorShape;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
    }


    @Override
    public void run() {
        Symbol symbol = symbolProvider.toSymbol(errorShape);

        // Did not add this as a symbol to the error shape since these should not be used by anyone but the user.
        String typeName = symbol.getName() + "Error";

        writer.openBlock("export class $L implements $T {", "}",
                typeName,
                symbol,
                () -> {

            writer.write("readonly name = $S;", errorShape.getId().getName());
            writer.write("readonly $$fault = $S;", errorShape.expectTrait(ErrorTrait.class).getValue());
            //TODO: remove me when we fix where $metadata goes
            writer.write("readonly $$metadata = {};");
            if (!errorShape.members().isEmpty()) {
                writer.write("");
                StructuredMemberWriter structuredMemberWriter = new StructuredMemberWriter(
                        model, symbolProvider, errorShape.getAllMembers().values());
                structuredMemberWriter.writeMembers(writer, errorShape);
                writer.write("");
                structuredMemberWriter.writeConstructor(writer, errorShape);
            }
        });
    }
}
