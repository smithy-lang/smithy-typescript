/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.util.ServiceLoader;
import java.util.ServiceLoader.Provider;
import java.util.logging.Logger;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.build.SmithyBuildPlugin;
import software.amazon.smithy.codegen.core.directed.CodegenDirector;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Plugin to trigger TypeScript client code generation.
 */
@SmithyInternalApi
public class TypeScriptClientCodegenPlugin implements SmithyBuildPlugin {
    private static final Logger LOGGER = Logger.getLogger(TypeScriptClientCodegenPlugin.class.getName());

    @Override
    public String getName() {
        return "typescript-client-codegen";
    }

    @Override
    public void execute(PluginContext context) {
        CodegenDirector<TypeScriptWriter, TypeScriptIntegration, TypeScriptCodegenContext, TypeScriptSettings> runner =
                new CodegenDirector<>();

        runner.directedCodegen(new DirectedTypeScriptCodegen());

        // Set the SmithyIntegration class to look for and apply using SPI.
        runner.integrationClass(TypeScriptIntegration.class);

        // Set the FileManifest and Model from the plugin.
        runner.fileManifest(context.getFileManifest());
        runner.model(context.getModel());

        // Create the TypeScriptSettings object from the plugin settings.
        TypeScriptSettings settings = TypeScriptSettings.from(context.getModel(),
                context.getSettings(),
                TypeScriptSettings.ArtifactType.CLIENT);
        runner.settings(settings);

        // Only add integrations if the integrations match the settings
        // This uses {@link TypeScriptIntegration#matchesSettings}, which is a
        // Smithy internal API. This may be removed at any point.
        runner.integrationFinder(
                () -> () -> ServiceLoader.load(TypeScriptIntegration.class, CodegenDirector.class.getClassLoader())
                        .stream()
                        .map(Provider::get)
                        .filter(integration -> {
                            boolean matchesSettings = integration.matchesSettings(settings);
                            if (!matchesSettings) {
                                LOGGER.fine(() -> "Skipping TypeScript integration based on settings: "
                                        + integration.name());
                            }
                            return matchesSettings;
                        })
                        .iterator());

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
