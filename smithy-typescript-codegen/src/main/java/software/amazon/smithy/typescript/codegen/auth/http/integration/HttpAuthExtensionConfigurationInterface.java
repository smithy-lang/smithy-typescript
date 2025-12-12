/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.auth.http.integration;

import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.typescript.codegen.auth.AuthUtils;
import software.amazon.smithy.typescript.codegen.extensions.ExtensionConfigurationInterface;
import software.amazon.smithy.utils.Pair;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Adds the corresponding interface and functions for {@code HttpAuthExtensionConfiguration}.
 */
@SmithyInternalApi
public class HttpAuthExtensionConfigurationInterface implements ExtensionConfigurationInterface {

    @Override
    public Pair<String, Dependency> name() {
        return Pair.of("HttpAuthExtensionConfiguration", AuthUtils.AUTH_HTTP_EXTENSION_DEPENDENCY);
    }

    @Override
    public Pair<String, Dependency> getExtensionConfigurationFn() {
        return Pair.of("getHttpAuthExtensionConfiguration", AuthUtils.AUTH_HTTP_EXTENSION_DEPENDENCY);
    }

    @Override
    public Pair<String, Dependency> resolveRuntimeConfigFn() {
        return Pair.of("resolveHttpAuthRuntimeConfig", AuthUtils.AUTH_HTTP_EXTENSION_DEPENDENCY);
    }
}
