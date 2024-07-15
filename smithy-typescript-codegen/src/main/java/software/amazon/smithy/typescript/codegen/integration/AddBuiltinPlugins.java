/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.integration;

import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_CONFIG;
import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_MIDDLEWARE;

import java.util.List;

import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Adds all built-in runtime client plugins to clients.
 */
@SmithyInternalApi
public class AddBuiltinPlugins implements TypeScriptIntegration {
    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        // Note that order is significant because configurations might
        // rely on previously resolved values.
        return List.of(
            RuntimeClientPlugin.builder()
                .withConventions(
                    TypeScriptDependency.CONFIG_RESOLVER.dependency, "CustomEndpoints", HAS_CONFIG)
                .servicePredicate((m, s) -> !isEndpointsV2Service(s))
                .build(),
            RuntimeClientPlugin.builder()
                .withConventions(TypeScriptDependency.MIDDLEWARE_RETRY.dependency, "Retry")
                .build(),
            RuntimeClientPlugin.builder()
                .withConventions(TypeScriptDependency.MIDDLEWARE_CONTENT_LENGTH.dependency, "ContentLength",
                    HAS_MIDDLEWARE)
                .build());
    }

    private static boolean isEndpointsV2Service(ServiceShape serviceShape) {
        return serviceShape.hasTrait(EndpointRuleSetTrait.class);
    }
}
