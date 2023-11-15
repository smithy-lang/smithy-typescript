/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_MIDDLEWARE;

import java.util.List;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Add middleware for {@code httpSigningMiddleware}.
 *
 * This is the experimental behavior for `experimentalIdentityAndAuth`.
 */
@SmithyInternalApi
public class AddHttpSigningPlugin implements TypeScriptIntegration {
    /**
     * Integration should only be used if `experimentalIdentityAndAuth` flag is true.
     */
    @Override
    public boolean matchesSettings(TypeScriptSettings settings) {
        return settings.getExperimentalIdentityAndAuth();
    }

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        return List.of(RuntimeClientPlugin.builder()
            .withConventions(
                TypeScriptDependency.SMITHY_CORE.dependency,
                "HttpSigning",
                HAS_MIDDLEWARE)
            .build());
    }
}
