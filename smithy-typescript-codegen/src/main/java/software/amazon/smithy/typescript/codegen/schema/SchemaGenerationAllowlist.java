/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import java.util.HashSet;
import java.util.Set;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
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

    public static boolean allows(String serviceShapeId, TypeScriptSettings settings) {
        return ALLOWED.contains(serviceShapeId) && settings.generateSchemas();
    }

    public static boolean allows(ShapeId serviceShapeId, TypeScriptSettings settings) {
        return ALLOWED.contains(serviceShapeId.toString()) && settings.generateSchemas();
    }

    public static void allow(String serviceShapeId) {
        ALLOWED.add(serviceShapeId);
    }
}
