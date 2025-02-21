/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import java.util.HashMap;
import java.util.Map;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.KnowledgeIndex;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.SetShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Can determine whether a Schema can be left undefined because it has no
 * behavior difference with its Document counterpart.
 */
@SmithyInternalApi
final class SchemaElisionIndex implements KnowledgeIndex {
    public final SchemaTraitFilterIndex traits;
    private final Model model;
    private final Map<Shape, Boolean> cache = new HashMap<>();

    SchemaElisionIndex(Model model) {
        this.model = model;
        for (Shape shape : model.toSet()) {
            cache.put(shape, matchesDefaultSchema(shape));
        }
        traits = SchemaTraitFilterIndex.of(model);
    }

    public static SchemaElisionIndex of(Model model) {
        return model.getKnowledge(SchemaElisionIndex.class, SchemaElisionIndex::new);
    }

    /**
     * Discernible in the JS runtime means that the value can be identified as a specific
     * Smithy Prelude simple type at runtime. This is any simple type except blob and
     * timestamp, because their serialized runtime representation can be
     * mistaken for e.g. string/number.
     *
     * @param shape - to inspect.
     * @return whether shape or its target type is discernible in the JS runtime.
     */
    public boolean isRuntimeDiscernibleSimpleType(Shape shape) {
        Shape target = shape;
        if (shape.isMemberShape()) {
            MemberShape memberShape = (MemberShape) shape;
            target = model.expectShape(memberShape.getTarget());
        }
        switch (target.getType()) {
            case LIST, SET, MAP, STRUCTURE, UNION, TIMESTAMP, BLOB -> {
                return false;
            }
            default -> {
                return true;
            }
        }
    }

    /**
     * @param shape - query.
     * @return whether shape's schema can be entirely omitted, because it matches
     * the default schema and it has no meaningful traits.
     */
    public boolean omitSchema(Shape shape) {
        return omitSchema(shape, 0);
    }

    public boolean omitSchema(Shape shape, int depth) {
        return depth < 20
            && !shape.hasTrait(ErrorTrait.class)
            && !traits.hasSchemaTraits(shape)
            && shape.getAllMembers()
                .values()
                .stream()
                .allMatch(ms -> omitSchema(ms, depth + 1))
            && shape.asMemberShape()
                .map(memberShape -> omitSchema(model.expectShape(memberShape.getTarget()), depth + 1))
                .orElse(true)
            && matchesDefaultSchema(shape, depth + 1);
    }

    /**
     * @param shape - query.
     * @return whether shape's schema has no differences from Document.
     */
    public boolean matchesDefaultSchema(Shape shape) {
        return matchesDefaultSchema(shape, 0);
    }

    private boolean matchesDefaultSchema(Shape shape, int depth) {
        if (cache.containsKey(shape)) {
            return cache.get(shape);
        }

        if (depth >= 20) {
            cache.put(shape, false);
            return true;
        }

        switch (shape.getType()) {
            case BOOLEAN,
                 STRING,
                 BYTE, SHORT, INTEGER, LONG, FLOAT, DOUBLE, BIG_DECIMAL, BIG_INTEGER,
                 DOCUMENT,
                 ENUM, INT_ENUM -> {
                cache.put(shape, true);
                return true;
            }
            case LIST, SET, MAP -> {
                boolean omit = false;
                if (shape.isListShape()) {
                    ListShape listShape = shape.asListShape().get();
                    omit = matchesDefaultSchema(listShape.getMember(), depth + 1);
                } else if (shape.isSetShape()) {
                    SetShape setShape = shape.asSetShape().get();
                    omit = matchesDefaultSchema(setShape.getMember(), depth + 1);
                } else if (shape.isMapShape()) {
                    MapShape mapShape = shape.asMapShape().get();
                    omit = matchesDefaultSchema(mapShape.getValue(), depth + 1);
                }
                cache.put(shape, omit);
                return omit;
            }
            case STRUCTURE -> {
                boolean omit = shape.asStructureShape().get()
                    .getAllMembers()
                    .values().stream()
                    .allMatch(s -> matchesDefaultSchema(s, depth + 1));
                cache.put(shape, omit);
                return omit;
            }
            case UNION -> {
                boolean omit = shape.asUnionShape().get()
                    .getAllMembers()
                    .values().stream()
                    .allMatch(s -> matchesDefaultSchema(s, depth + 1));
                cache.put(shape, omit);
                return omit;
            }
            case MEMBER -> {
                MemberShape memberShape = shape.asMemberShape().get();
                return matchesDefaultSchema(model.expectShape(memberShape.getTarget()), depth + 1);
            }
            default -> {
                // blob, timestamp
                cache.put(shape, false);
                return false;
            }
        }
    }
}
