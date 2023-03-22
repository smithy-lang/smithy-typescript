/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.validation;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.selector.Selector;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.traits.SensitiveTrait;
import software.amazon.smithy.model.traits.StreamingTrait;

/**
 * This validator tells you whether a shape contains sensitive data fields.
 * This is used to decide whether a sensitive log filter function needs to be
 * generated for
 * a given shape.
 */
public class SensitiveDataFinder {
    private Map<Shape, Boolean> cache = new HashMap<>();
    private final Model model;

    /**
     * @param model - model context for the {@link #findsSensitiveDataIn(Shape)}
     *              queries.
     */
    public SensitiveDataFinder(Model model) {
        this.model = model;
    }

    /**
     * @param shape - the shape in question.
     * @return whether a sensitive field exists in the shape and its downstream
     *         shapes.
     */
    public boolean findsSensitiveDataIn(Shape shape) {
        boolean found = findRecursive(shape);
        cache.put(shape, found);
        return found;
    }

    private boolean findRecursive(Shape shape) {
        if (cache.containsKey(shape)) {
            return cache.get(shape);
        }

        if (shape.hasTrait(SensitiveTrait.class)
                || shape.hasTrait(StreamingTrait.class)) {
            cache.put(shape, true);
            return true;
        }

        if (shape.getMemberTrait(model, SensitiveTrait.class).isPresent()
                || shape.getMemberTrait(model, StreamingTrait.class).isPresent()) {
            cache.put(shape, true);
            return true;
        }

        Selector sensitiveSelector = Selector.parse("[id = '" + shape.getId() + "']" + " ~> [trait|sensitive]");
        Selector streamingSelector = Selector.parse("[id = '" + shape.getId() + "']" + " ~> [trait|streaming]");
        Set<Shape> matches = sensitiveSelector.select(model);
        matches.addAll(streamingSelector.select(model));

        boolean found = !matches.isEmpty();
        if (found) {
            cache.put(shape, true);
            return true;
        }

        if (shape instanceof MapShape) {
            MemberShape keyMember = ((MapShape) shape).getKey();
            MemberShape valMember = ((MapShape) shape).getValue();
            return findRecursive(keyMember) || findRecursive(valMember);
        }

        cache.put(shape, false);
        return false;
    }
}
