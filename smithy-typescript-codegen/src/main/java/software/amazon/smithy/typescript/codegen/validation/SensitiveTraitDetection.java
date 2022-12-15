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

package software.amazon.smithy.typescript.codegen.validation;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.SensitiveTrait;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;


public abstract class SensitiveTraitDetection {
    private static final Map<Shape, Boolean> SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE = new HashMap<>();

    private SensitiveTraitDetection() {}

    /**
     * @return whether an operation has {@link SensitiveTrait} on the input or output structures.
     */
    public static boolean operationIncludesSensitiveField(ProtocolGenerator.GenerationContext context,
                                                          OperationShape operation) {
        Function<ShapeId, Shape> getShape = (shape) -> context.getModel().getShape(shape).get();
        return SensitiveTraitDetection.check(
            context,
            getShape.apply(operation.getInputShape())
        ) || SensitiveTraitDetection.check(
            context,
            getShape.apply(operation.getOutputShape())
        );
    }

    public static boolean check(ProtocolGenerator.GenerationContext context, Shape shape) {
        return recursiveCheck(context, shape);
    }

    /**
     * This method is separated out to make logging the top level public call easier.
     */
    private static boolean recursiveCheck(ProtocolGenerator.GenerationContext context, Shape shape) {
        if (shape.hasTrait(SensitiveTrait.class)) {
            SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE.put(shape, true);
            return true;
        }
        if (SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE.containsKey(shape)) {
            return SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE.get(shape);
        }

        // prime cache value in case of recursive shape.
        SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE.put(shape, false);

        for (Map.Entry<String, MemberShape> entry : shape.getAllMembers().entrySet()) {
            MemberShape member = entry.getValue();
            if (recursiveCheck(context, member)) {
                SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE.put(shape, true);
                SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE.put(member, true);
                return true;
            }
            Shape target = context.getModel().getShape(member.getTarget()).get();
            if (recursiveCheck(context, target)) {
                SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE.put(shape, true);
                SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE.put(target, true);
                return true;
            }
        }
        SHAPE_CONTAINS_SENSITIVE_MEMBER_CACHE.put(shape, false);
        return false;
    }
}
