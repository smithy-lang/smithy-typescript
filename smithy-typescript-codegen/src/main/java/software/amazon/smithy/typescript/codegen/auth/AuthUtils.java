/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth;

import java.util.Map;
import java.util.TreeMap;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.knowledge.ServiceIndex.AuthSchemeMode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.typescript.codegen.auth.http.SupportedHttpAuthSchemesIndex;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Auth utility methods needed across Java packages.
 */
@SmithyInternalApi
public final class AuthUtils {
    private AuthUtils() {}

    public static Map<ShapeId, HttpAuthScheme> getAllEffectiveNoAuthAwareAuthSchemes(
        ServiceShape serviceShape,
        ServiceIndex serviceIndex,
        SupportedHttpAuthSchemesIndex authIndex
    ) {
        Map<ShapeId, HttpAuthScheme> effectiveAuthSchemes = new TreeMap<>();
        var serviceEffectiveAuthSchemes =
            serviceIndex.getEffectiveAuthSchemes(serviceShape, AuthSchemeMode.NO_AUTH_AWARE);
        for (ShapeId shapeId : serviceEffectiveAuthSchemes.keySet()) {
            effectiveAuthSchemes.put(shapeId, authIndex.getHttpAuthScheme(shapeId));
        }
        for (var operation : serviceShape.getAllOperations()) {
            var operationEffectiveAuthSchemes =
                serviceIndex.getEffectiveAuthSchemes(serviceShape, operation, AuthSchemeMode.NO_AUTH_AWARE);
            for (ShapeId shapeId : operationEffectiveAuthSchemes.keySet()) {
                effectiveAuthSchemes.put(shapeId, authIndex.getHttpAuthScheme(shapeId));
            }
        }
        return effectiveAuthSchemes;
    }
}
