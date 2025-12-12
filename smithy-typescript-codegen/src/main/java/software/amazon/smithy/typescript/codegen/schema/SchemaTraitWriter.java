/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.schema;

import java.util.List;
import java.util.Objects;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.HttpLabelTrait;
import software.amazon.smithy.model.traits.HttpPayloadTrait;
import software.amazon.smithy.model.traits.HttpQueryParamsTrait;
import software.amazon.smithy.model.traits.HttpResponseCodeTrait;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.IdempotentTrait;
import software.amazon.smithy.model.traits.SensitiveTrait;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.typescript.codegen.util.StringStore;

class SchemaTraitWriter {

    private final Shape shape;
    private final SchemaReferenceIndex elision;
    private final StringStore stringStore;
    private final StringBuilder buffer = new StringBuilder();
    private final List<ShapeId> compressTraits = List.of(
        HttpLabelTrait.ID,
        IdempotentTrait.ID,
        IdempotencyTokenTrait.ID,
        SensitiveTrait.ID,
        HttpPayloadTrait.ID,
        HttpResponseCodeTrait.ID,
        HttpQueryParamsTrait.ID
    );
    private final SchemaTraitGenerator traitGenerator = new SchemaTraitGenerator();

    SchemaTraitWriter(Shape shape, SchemaReferenceIndex elision, StringStore stringStore) {
        this.shape = shape;
        this.elision = elision;
        this.stringStore = stringStore;
    }

    /**
     * @return either the numeric bitvector or object representation of
     * the traits on the input shape.
     */
    @Override
    public String toString() {
        if (mayUseCompressedTraits()) {
            writeTraitsBitVector();
        } else {
            writeTraitsObject();
        }
        return buffer.toString();
    }

    private boolean mayUseCompressedTraits() {
        return shape
            .getAllTraits()
            .values()
            .stream()
            .map(Trait::toShapeId)
            .filter(elision.traits::includeTrait)
            .allMatch(compressTraits::contains);
    }

    private void writeTraitsBitVector() {
        int bits = 0;
        for (int i = 0; i < compressTraits.size(); ++i) {
            if (shape.hasTrait(compressTraits.get(i))) {
                bits |= (1 << i);
            }
        }
        buffer.append(Objects.toString(bits));
    }

    private void writeTraitsObject() {
        buffer.append("{ ");

        shape
            .getAllTraits()
            .forEach((shapeId, trait) -> {
                if (!elision.traits.includeTrait(trait.toShapeId())) {
                    return;
                }
                buffer.append(
                    """
                    [%s]: %s,\s""".formatted(
                        stringStore.var(shapeId.getName()),
                        traitGenerator.serializeTraitData(trait, stringStore)
                    )
                );
            });

        buffer.deleteCharAt(buffer.length() - 1);
        buffer.deleteCharAt(buffer.length() - 1);
        buffer.append(" }");
    }
}
