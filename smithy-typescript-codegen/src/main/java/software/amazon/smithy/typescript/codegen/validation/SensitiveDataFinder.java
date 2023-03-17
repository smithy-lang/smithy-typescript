/*
 * Copyright 2023 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

package software.amazon.smithy.typescript.codegen.validation;

import java.util.HashMap;
import java.util.Map;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.SimpleShape;
import software.amazon.smithy.model.traits.SensitiveTrait;

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

        if (shape.hasTrait(SensitiveTrait.class)) {
            cache.put(shape, true);
            return true;
        }

        if (shape instanceof MemberShape) {
            MemberShape memberShape = (MemberShape) shape;
            if (memberShape.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
                cache.put(shape, true);
                return true;
            }
            Shape memberTarget = model.expectShape(memberShape.getTarget());
            return findRecursive(memberTarget, model);
        }

        if (shape.getMemberTrait(model, SensitiveTrait.class).isPresent()) {
            cache.put(shape, true);
            return true;
        } else if (shape instanceof SimpleShape) {
            cache.put(shape, false);
            return false;
        } else if (shape.isStructureShape() || shape.isUnionShape()) {
            boolean found = shape.getAllMembers()
                    .values()
                    .stream()
                    .anyMatch(m -> findRecursive(m, model));

            cache.put(shape, found);
            return found;
        } else if (shape instanceof CollectionShape) {
            MemberShape collectionMember = ((CollectionShape) shape).getMember();
            return findRecursive(collectionMember, model);
        } else if (shape instanceof MapShape) {
            MemberShape keyMember = ((MapShape) shape).getKey();
            MemberShape valMember = ((MapShape) shape).getValue();
            return findRecursive(keyMember, model) || findRecursive(valMember, model);
        }

        cache.put(shape, false);
        return false;
    }
}
