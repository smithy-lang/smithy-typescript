/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.build.SmithyBuildPlugin;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Plugin to trigger schema-based TypeScript SSDK code generation.
 *
 * <p>Delegates to {@link TypeScriptCodegenPlugin} with the fixed
 * {@link TypeScriptSettings.ArtifactType#SSDK} artifact type.
 */
@SmithyInternalApi
@SuppressWarnings("AbbreviationAsWordInName")
public class TypeScriptSchemaSSDKCodegenPlugin implements SmithyBuildPlugin {

    @Override
    public String getName() {
        return "typescript-schema-ssdk-codegen";
    }

    @Override
    public void execute(PluginContext context) {
        TypeScriptSettings settings = TypeScriptSettings.from(
            context.getModel(),
            context.getSettings(),
            TypeScriptSettings.ArtifactType.SSDK
        );
        settings.setGenerateServerSchema(true);
        new TypeScriptCodegenPlugin().execute(context, settings);
    }
}
