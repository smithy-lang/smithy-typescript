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
 * @deprecated Use {@link TypeScriptServerCodegenPlugin} instead.
 */
@SmithyInternalApi
@Deprecated
@SuppressWarnings("AbbreviationAsWordInName")
public class TypeScriptSSDKCodegenPlugin implements SmithyBuildPlugin {

    @Override
    public String getName() {
        return "typescript-ssdk-codegen";
    }

    @Override
    public void execute(PluginContext context) {
        new TypeScriptCodegenPlugin().execute(context, TypeScriptSettings.ArtifactType.SSDK);
    }
}
