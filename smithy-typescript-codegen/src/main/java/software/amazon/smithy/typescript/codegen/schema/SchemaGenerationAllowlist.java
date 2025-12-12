/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.schema;

import java.util.HashSet;
import java.util.Set;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.protocol.traits.Rpcv2CborTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 *
 * Controls rollout of schema generation.
 *
 */
@SmithyInternalApi
public abstract class SchemaGenerationAllowlist {

    private static final Set<ShapeId> ALLOWED = new HashSet<>();
    private static final Set<ShapeId> PROTOCOLS = new HashSet<>();

    static {
        ALLOWED.add(ShapeId.from("smithy.protocoltests.rpcv2Cbor#RpcV2Protocol"));
        ALLOWED.add(ShapeId.from("org.xyz.v1#XYZService"));
        PROTOCOLS.add(Rpcv2CborTrait.ID);
    }

    public static boolean allows(ShapeId serviceShapeId, TypeScriptSettings settings) {
        boolean generateClient = settings.generateClient();
        boolean allowedByProtocol = PROTOCOLS.contains(settings.getProtocol());
        boolean allowedByName = ALLOWED.contains(serviceShapeId);
        return settings.generateSchemas() && generateClient && (allowedByProtocol || allowedByName);
    }

    @Deprecated
    public static void allow(String serviceShapeId) {
        ALLOWED.add(ShapeId.from(serviceShapeId));
    }

    public static void allow(ShapeId serviceShapeId) {
        ALLOWED.add(serviceShapeId);
    }

    public static void allowProtocol(ShapeId protocolShapeId) {
        PROTOCOLS.add(protocolShapeId);
    }
}
