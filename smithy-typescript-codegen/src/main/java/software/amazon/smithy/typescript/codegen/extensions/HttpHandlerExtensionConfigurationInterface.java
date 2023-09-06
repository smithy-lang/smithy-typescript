/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.extensions;

import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.utils.Pair;

public class HttpHandlerExtensionConfigurationInterface implements ExtensionConfigurationInterface {

    @Override
    public Pair<String, Dependency> name() {
        return Pair.of("HttpHandlerExtensionConfiguration", TypeScriptDependency.PROTOCOL_HTTP);
    }

    @Override
    public Pair<String, Dependency> getExtensionConfigurationFn() {
        return Pair.of("getHttpHandlerExtensionConfiguration", TypeScriptDependency.PROTOCOL_HTTP);
    }

    @Override
    public Pair<String, Dependency> resolveRuntimeConfigFn() {
        return Pair.of("resolveHttpHandlerRuntimeConfig", TypeScriptDependency.PROTOCOL_HTTP);
    }
}
