/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.build.SmithyBuildPlugin;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Plugin to trigger TypeScript SSDK code generation.
 *
 * <p>Delegates to {@link TypeScriptCodegenPlugin} with the fixed
 * {@link TypeScriptSettings.ArtifactType#SSDK} artifact type.
 */
@SmithyInternalApi
public class TypeScriptServerCodegenPlugin implements SmithyBuildPlugin {

    @Override
    public String getName() {
        return "typescript-server-codegen";
    }

    @Override
    public void execute(PluginContext context) {
        new TypeScriptCodegenPlugin().execute(context, TypeScriptSettings.ArtifactType.SSDK);
    }
}
