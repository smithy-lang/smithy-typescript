/*
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package software.amazon.smithy.typescript.codegen;

import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.build.SmithyBuildPlugin;
import software.amazon.smithy.codegen.core.directed.CodegenDirector;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Plugin to trigger TypeScript SSDK code generation.
 */
@SmithyInternalApi
public class TypeScriptServerCodegenPlugin implements SmithyBuildPlugin {

    @Override
    public String getName() {
        return "typescript-ssdk-codegen";
    }

    @Override
    public void execute(PluginContext context) {
        CodegenDirector<TypeScriptWriter, TypeScriptIntegration, TypeScriptCodegenContext, TypeScriptSettings> runner
                = new CodegenDirector<>();

        runner.directedCodegen(new DirectedTypeScriptCodegen());

        // Set the SmithyIntegration class to look for and apply using SPI.
        runner.integrationClass(TypeScriptIntegration.class);

        // Set the FileManifest and Model from the plugin.
        runner.fileManifest(context.getFileManifest());
        runner.model(context.getModel());

        // Create the TypeScriptSettings object from the plugin settings.
        TypeScriptSettings settings = TypeScriptSettings.from(context.getModel(), context.getSettings(),
                TypeScriptSettings.ArtifactType.SSDK);
        runner.settings(settings);

        runner.service(settings.getService());

        // Configure the director to perform some common model transforms.
        runner.performDefaultCodegenTransforms();

        // TODO: Not using below because it would break existing AWS SDKs. Maybe it should be configurable
        // so generic SDKs call this by default, but AWS SDKs can opt-out of it via a setting.
        // runner.createDedicatedInputsAndOutputs();

        // Run it!
        runner.run();
    }
}
