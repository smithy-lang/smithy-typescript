/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.KnowledgeIndex;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeType;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Can determine whether a Schema can be defined by a sentinel value.
 */
@SmithyInternalApi
public final class SchemaReferenceIndex implements KnowledgeIndex {

    public final SchemaTraitFilterIndex traits;
    private final Model model;

    SchemaReferenceIndex(Model model) {
        this.model = model;
        traits = SchemaTraitFilterIndex.of(model);
    }

    public static SchemaReferenceIndex of(Model model) {
        return model.getKnowledge(SchemaReferenceIndex.class, SchemaReferenceIndex::new);
    }

    /**
     * A reference shape is a function pointer to a shape that doesn't have a constant numeric
     * sentinel value.
     * Simple non-aggregate types and lists/maps of those types are considered non-reference
     * in TypeScript.
     *
     * @return whether shape is a reference shape.
     */
    public boolean isReferenceSchema(Shape shape) {
        Shape targetShape = shape;
        if (shape instanceof MemberShape member) {
            targetShape = model.expectShape(member.getTarget());
        }
        ShapeType type = targetShape.getType();
        switch (type) {
            case
                STRING,
                BOOLEAN,
                BYTE,
                DOUBLE,
                FLOAT,
                SHORT,
                INTEGER,
                LONG,
                ENUM,
                INT_ENUM,
                BIG_INTEGER,
                BIG_DECIMAL,
                TIMESTAMP,
                BLOB,
                DOCUMENT -> {
                return false;
            }
            case LIST, SET, MAP -> {
                if (shape instanceof CollectionShape collection) {
                    return isReferenceSchema(collection.getMember());
                } else if (shape instanceof MapShape map) {
                    return isReferenceSchema(map.getValue());
                }
                return true;
            }
            default -> {
                return true;
            }
        }
    }
}
