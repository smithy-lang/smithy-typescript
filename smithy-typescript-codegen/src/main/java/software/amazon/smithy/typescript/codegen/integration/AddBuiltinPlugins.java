/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.integration;

import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_MIDDLEWARE;

import java.util.List;
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
                    "@smithy/core/retry",
                    TypeScriptDependency.SMITHY_CORE.dependency.getVersion(),
                    "Retry"
                )
                .build(),
            RuntimeClientPlugin.builder()
                .withConventions(
                    "@smithy/core/protocols",
                    TypeScriptDependency.SMITHY_CORE.dependency.getVersion(),
                    "ContentLength",
                    HAS_MIDDLEWARE
                )
                .build()
        );
    }
}
