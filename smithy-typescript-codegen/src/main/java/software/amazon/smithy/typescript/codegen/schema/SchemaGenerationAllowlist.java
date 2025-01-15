/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import java.util.HashSet;
import java.util.Set;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.utils.SmithyInternalApi;


/**
 *
 * Controls rollout of schema generation.
 *
 */
@SmithyInternalApi
public abstract class SchemaGenerationAllowlist {
    private static final Set<String> ALLOWED = new HashSet<>();

    static {
        ALLOWED.add("smithy.protocoltests.rpcv2Cbor#RpcV2Protocol");
    }

    public static boolean contains(String serviceShapeId) {
        return ALLOWED.contains(serviceShapeId);
    }

    public static boolean contains(ShapeId serviceShapeId) {
        return ALLOWED.contains(serviceShapeId.toString());
    }

    public static void allow(String serviceShapeId) {
        ALLOWED.add(serviceShapeId);
    }
}
