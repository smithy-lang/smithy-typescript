/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.knowledge;

import java.util.HashMap;
import java.util.Map;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.KnowledgeIndex;
import software.amazon.smithy.model.selector.Selector;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.ToShapeId;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.JsonNameTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.SparseTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.utils.MapUtils;

/**
 * Index of ShapeIds to a boolean indicating whether a shape's serde function
 * may be omitted. If the shape is of a certain type, and has no downstream
 * incompatible shapes or traits that require additional handling, its serde
 * function may be emitted.
 */
public class SerdeElisionIndex implements KnowledgeIndex {

    private final Map<ShapeId, Boolean> elisionBinding = new HashMap<>();
    private final Map<String, ShapeId> mutatingTraits = MapUtils.of(
        "jsonName",
        JsonNameTrait.ID,
        "streaming",
        StreamingTrait.ID,
        "mediaType",
        MediaTypeTrait.ID,
        "sparse",
        SparseTrait.ID,
        "idempotencyToken",
        IdempotencyTokenTrait.ID
    );

    public SerdeElisionIndex(Model model) {
        for (Shape shape : model.toSet()) {
            elisionBinding.put(shape.toShapeId(), canBeElided(shape, model));
        }
    }

    public static SerdeElisionIndex of(Model model) {
        return model.getKnowledge(SerdeElisionIndex.class, SerdeElisionIndex::new);
    }

    public boolean mayElide(ToShapeId id) {
        return elisionBinding.getOrDefault(id.toShapeId(), false);
    }

    private boolean canBeElided(Shape shape, Model model) {
        if (hasIncompatibleTypes(shape, model, 0)) {
            return false;
        }
        return !hasMutatingTraits(shape, model);
    }

    private boolean hasMutatingTraits(Shape shape, Model model) {
        for (var entry : mutatingTraits.entrySet()) {
            if (shape.hasTrait(entry.getValue())) {
                return true;
            }
            if (shape instanceof MemberShape memberShape) {
                if (model.expectShape(memberShape.getTarget()).hasTrait(entry.getValue())) {
                    return true;
                }
            }
            Selector selector = Selector.parse("[id = '" + shape.getId() + "']" + " ~> [trait|" + entry.getKey() + "]");
            if (!selector.select(model).isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private boolean hasIncompatibleTypes(Shape shape, Model model, int depth) {
        if (depth > 10) {
            return true; // bailout for recursive types.
        }

        Shape target = shape;
        if (shape.isMemberShape()) {
            target = model.expectShape(shape.asMemberShape().get().getTarget());
        }

        switch (target.getType()) {
            case LIST:
                return hasIncompatibleTypes(target.asListShape().get().getMember(), model, depth + 1);
            case SET:
                return hasIncompatibleTypes(target.asSetShape().get().getMember(), model, depth + 1);
            case STRUCTURE:
                return target
                    .asStructureShape()
                    .get()
                    .getAllMembers()
                    .values()
                    .stream()
                    .anyMatch(s -> hasIncompatibleTypes(s, model, depth + 1));
            case UNION:
                return target
                    .asUnionShape()
                    .get()
                    .getAllMembers()
                    .values()
                    .stream()
                    .anyMatch(s -> hasIncompatibleTypes(s, model, depth + 1));
            case MAP:
                return hasIncompatibleTypes(
                    model.getShape(target.asMapShape().get().getValue().getTarget()).get(),
                    model,
                    depth + 1
                );
            case BIG_DECIMAL:
            case BIG_INTEGER:
            case BLOB:
            case DOCUMENT:
            case TIMESTAMP:
            case DOUBLE: // possible call to parseFloatString or serializeFloat.
            case FLOAT: // possible call to parseFloatString or serializeFloat.
                // types that generate parsers.
                return true;
            case MEMBER:
            case OPERATION:
            case RESOURCE:
            case SERVICE:
                // non-applicable types.
                return false;
            case BOOLEAN:
            case BYTE:
            case ENUM:
            case INTEGER:
            case INT_ENUM:
            case LONG:
            case SHORT:
            case STRING:
            default:
                // compatible types with no special parser.
                return false;
        }
    }
}
