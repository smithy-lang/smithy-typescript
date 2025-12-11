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

package software.amazon.smithy.typescript.codegen;

import java.util.Comparator;
import java.util.Map;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.shapes.IntEnumShape;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates an appropriate TypeScript type from a Smithy intEnum shape.
 *
 * <p>For example, given the following Smithy model:</p>
 *
 * <pre>{@code
 * intEnum FaceCard {
 *     JACK = 1
 *     QUEEN = 2
 *     KING = 3
 * }
 * }</pre>
 *
 * <p>We will generate the following:
 *
 * <pre>{@code
 * export enum FaceCard {
 *   JACK = 1,
 *   QUEEN = 2,
 *   KING = 3,
 * }
 * }</pre>
 *
 * <p>Shapes that refer to this intEnum as a member will use the following
 * generated code:
 *
 * <pre>{@code
 * import { FaceCard } from "./FaceCard";
 *
 * interface MyStructure {
 *   "facecard": FaceCard;
 * }
 * }</pre>
 */
@SmithyInternalApi
final class IntEnumGenerator implements Runnable {

    private final Symbol symbol;
    private final IntEnumShape shape;
    private final TypeScriptWriter writer;

    IntEnumGenerator(IntEnumShape shape, Symbol symbol, TypeScriptWriter writer) {
        this.shape = shape;
        this.symbol = symbol;
        this.writer = writer;
    }

    @Override
    public void run() {
        generateIntEnum();
    }

    private void generateIntEnum() {
        writer.openBlock("export enum $L {", "}", symbol.getName(), () -> {
            // Sort by the values to ensure a stable order and sane diffs.
            shape
                .getEnumValues()
                .entrySet()
                .stream()
                .sorted(Comparator.comparing(e -> e.getValue()))
                .forEach(this::writeIntEnumEntry);
        });
    }

    private void writeIntEnumEntry(Map.Entry<String, Integer> entry) {
        writer.write("$L = $L,", TypeScriptUtils.sanitizePropertyName(entry.getKey()), entry.getValue());
    }
}
