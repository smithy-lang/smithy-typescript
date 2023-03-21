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

public class SensitiveDataFinder {
    private Map<Shape, Boolean> cache = new HashMap<>();

    public boolean findsSensitiveData(Shape shape, Model model) {
        boolean found = findRecursive(shape, model);
        cache.put(shape, found);
        return found;
    }

    private boolean findRecursive(Shape shape, Model model) {
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
            return findRecursive(keyMember, model) || findRecursive(valMember, model);
        }

        cache.put(shape, false);
        return false;
    }
}
