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
 */
@SmithyInternalApi
public class AddHttpSigningPlugin implements TypeScriptIntegration {
    /**
     * Integration should be skipped if the `useLegacyAuth` flag is true.
     */
    @Override
    public boolean matchesSettings(TypeScriptSettings settings) {
        return !settings.useLegacyAuth();
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
