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

import java.util.Comparator;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.traits.EnumDefinition;
import software.amazon.smithy.model.traits.EnumTrait;

/**
 * Generates an appropriate TypeScript type from a Smithy enum string.
 *
 * <p>For example, given the following Smithy model:
 *
 * <pre>{@code
 * @enum("YES": {name: "YEP"}, "NO": {name: "NOPE"})
 * string TypedYesNo
 * }</pre>
 *
 * <p>We will generate the following:
 *
 * <pre>{@code
 * export enum TypedYesNo {
 *   YES: "YEP",
 *   NO: "NOPE",
 * }
 * }</pre>
 *
 * <p>Shapes that refer to this string as a member will use the following
 * generated code:
 *
 * <pre>{@code
 * import { TypedYesNo } from "./TypedYesNo";
 *
 * interface MyStructure {
 *   "yesNo": TypedYesNo | string;
 * }
 * }</pre>
 */
final class EnumGenerator implements Runnable {

    private final Symbol symbol;
    private final StringShape shape;
    private final TypeScriptWriter writer;
    private final EnumTrait enumTrait;

    EnumGenerator(StringShape shape, Symbol symbol, TypeScriptWriter writer) {
        assert shape.getTrait(EnumTrait.class).isPresent();

        this.shape = shape;
        this.symbol = symbol;
        this.writer = writer;
        enumTrait = shape.getTrait(EnumTrait.class).get();
    }

    @Override
    public void run() {
        if (!enumTrait.hasNames()) {
            generateUnnamedEnum();
        } else {
            generateNamedEnum();
        }
    }

    // Unnamed enums generate a union of string literals.
    private void generateUnnamedEnum() {
        String variants = TypeScriptUtils.getEnumVariants(enumTrait.getEnumDefinitionValues());
        writer.write("export type $L = $L", symbol.getName(), variants);
    }

    // Named enums generate an actual enum type.
    private void generateNamedEnum() {
        writer.openBlock("export enum $L {", "}", symbol.getName(), () -> {
            // Sort the named values to ensure a stable order and sane diffs.
            // TODO: Should we just sort these in the trait itself?
            enumTrait.getValues()
                    .stream()
                    .sorted(Comparator.comparing(e -> e.getName().get()))
                    .forEach(this::writeNamedEnumConstant);
        });
    }

    private void writeNamedEnumConstant(EnumDefinition body) {
        assert body.getName().isPresent();

        String name = body.getName().get();
        body.getDocumentation().ifPresent(writer::writeDocs);
        writer.write("$L = $S,", TypeScriptUtils.sanitizePropertyName(name), body.getValue());
    }
}
