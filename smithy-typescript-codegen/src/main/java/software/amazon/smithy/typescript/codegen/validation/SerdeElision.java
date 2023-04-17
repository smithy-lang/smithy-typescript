/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.validation;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.selector.Selector;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.SetShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeType;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.JsonNameTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.SparseTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;

/**
 * For determining whether a serde function for a shape may be omitted.
 */
public final class SerdeElision {
    private static final Map<Model, SerdeElision> INSTANCES = new ConcurrentHashMap<>();
    private static final SerdeElision NULL_INSTANCE = new SerdeElision(null);
    private final Model model;
    private final Map<Shape, Boolean> cache = new ConcurrentHashMap<>();
    private boolean enabledForModel = false;

    private SerdeElision(Model model) {
        this.model = model;
    }

    /**
     * @param model - cache key.
     * @return cached instance for the given model.
     */
    public static SerdeElision forModel(Model model) {
        if (model == null) {
            return NULL_INSTANCE;
        }
        if (!INSTANCES.containsKey(model)) {
            INSTANCES.put(model, new SerdeElision(model));
        }
        return INSTANCES.get(model);
    }

    /**
     * @param shape - to be examined.
     * @return whether the shape's serializer/deserializer may be elided.
     *         To qualify, the shape must contain only booleans, strings, numbers
     *         and containers thereof, and not have any JsonName replacements or
     *         other mutation parsing effects like timestamps.
     *         The protocol context must be JSON (not checked in this method).
     */
    public boolean mayElide(Shape shape) {
        if (!enabledForModel) {
            return false;
        }
        boolean mayElide = check(shape);
        cache.put(shape, mayElide);
        return mayElide;
    }

    /**
     * This method allows the protocol and its serde implementation
     * to enable this feature selectively.
     * @param enabled - Gate for {@link #mayElide(Shape)}.
     * @return this for chaining.
     */
    public SerdeElision setEnabledForModel(boolean enabled) {
        enabledForModel = enabled;
        return this;
    }

    /**
     * Check for incompatible types and incompatible traits.
     * In both cases there exist special serde functions that make
     * omission of the serde function impossible without additional
     * handling.
     */
    private boolean check(Shape shape) {
        if (cache.containsKey(shape)) {
            return cache.get(shape);
        }

        if (isTraitDownstream(shape, JsonNameTrait.class, "jsonName")
            || isTraitDownstream(shape, StreamingTrait.class, "streaming")
            || isTraitDownstream(shape, MediaTypeTrait.class, "mediaType")
            || isTraitDownstream(shape, SparseTrait.class, "sparse")
            || isTraitDownstream(shape, TimestampFormatTrait.class, "timestampFormat")
            || isTraitDownstream(shape, IdempotencyTokenTrait.class, "idempotencyToken")) {
            cache.put(shape, false);
            return false;
        }

        if (hasIncompatibleTypes(shape)) {
            cache.put(shape, false);
            return false;
        }

        cache.put(shape, true);
        return true;
    }

    private boolean hasIncompatibleTypes(Shape shape) {
        return hasIncompatibleTypes(shape, new HashSet<>(), 0);
    }

    /**
     * Checks whether incompatible types exist downstream of the shape.
     * Incompatible types refers to types that need special serde mapping
     * functions, like timestamps.
     */
    private boolean hasIncompatibleTypes(Shape shape, Set<ShapeType> types, int depth) {
        if (depth > 10) {
            return true; // bailout for recursive types.
        }

        Shape target;
        if (shape instanceof MemberShape) {
            target = model.getShape(((MemberShape) shape).getTarget()).get();
        } else {
            target = shape;
        }

        switch (target.getType()) {
            case LIST:
                ListShape list = (ListShape) target;
                return hasIncompatibleTypes(list.getMember(), types, depth + 1);
            case SET:
                SetShape set = (SetShape) target;
                return hasIncompatibleTypes(set.getMember(), types, depth + 1);
            case STRUCTURE:
                StructureShape structure = (StructureShape) target;
                return structure.getAllMembers().values().stream().anyMatch(
                    s -> hasIncompatibleTypes(s, types, depth + 1)
                );
            case UNION:
                UnionShape union = (UnionShape) target;
                return union.getAllMembers().values().stream().anyMatch(
                    s -> hasIncompatibleTypes(s, types, depth + 1)
                );
            case MAP:
                MapShape map = (MapShape) target;
                return hasIncompatibleTypes(
                    model.getShape(map.getValue().getTarget()).get(),
                    types,
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

    private boolean isTraitDownstream(Shape shape, Class trait, String traitName) {
        if (shape.hasTrait(trait)) {
            return true;
        }

        if (shape.getMemberTrait(model, trait).isPresent()) {
            return true;
        }

        Selector selector = Selector.parse("[id = '" + shape.getId() + "']" + " ~> [trait|" + traitName + "]");
        Set<Shape> matches = selector.select(model);
        boolean found = !matches.isEmpty();

        if (found) {
            return true;
        }

        return false;
    }
}
