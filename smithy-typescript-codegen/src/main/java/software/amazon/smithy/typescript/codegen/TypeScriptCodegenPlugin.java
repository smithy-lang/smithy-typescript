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
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.directed.CodegenDirector;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Unified plugin for TypeScript code generation.
 *
 * <p>This is the central entry point that owns mode dispatch. The specialized
 * {@link TypeScriptClientCodegenPlugin}, {@link TypeScriptServerCodegenPlugin}, and (deprecated)
 * {@link TypeScriptSSDKCodegenPlugin} plugins retain their fixed historical modes and reject the
 * {@code modes} setting.
 *
 * <p>The {@code modes} setting selects what is generated and how generation is driven:
 * <ul>
 *     <li><b>Service mode</b> ({@code ["client"]} or {@code ["server"]}) - generation is driven
 *         by the {@code service}, which is required. Produces the client or server SDK for that
 *         service and every shape in its closure.</li>
 *     <li><b>Types mode</b> ({@code ["types"]}) - generation is driven by a {@code closure}
 *         (a {@code shapeClosures} metadata entry referenced by id), with no {@code service}.
 *         Produces only data shapes (structures, unions, enums, intEnums, lists, maps) and their
 *         schemas.</li>
 * </ul>
 *
 * <p>Configure via {@code smithy-build.json}:
 * <pre>{@code
 * {
 *   "plugins": {
 *     "typescript-codegen": {
 *       "service": "com.example#MyService",
 *       "package": "my-client",
 *       "packageVersion": "0.0.1",
 *       "modes": ["client"]
 *     }
 *   }
 * }
 * }</pre>
 */
@SmithyInternalApi
public class TypeScriptCodegenPlugin implements SmithyBuildPlugin {

    private static final Logger LOGGER = Logger.getLogger(TypeScriptCodegenPlugin.class.getName());

    @Override
    public String getName() {
        return "typescript-codegen";
    }

    @Override
    public void execute(PluginContext context) {
        execute(context, TypeScriptSettings.fromWithModes(context.getModel(), context.getSettings()));
    }

    /**
     * Runs codegen in a fixed mode for a specialized legacy plugin.
     *
     * @param context the plugin context.
     * @param artifactType the fixed artifact type to generate.
     */
    void execute(PluginContext context, TypeScriptSettings.ArtifactType artifactType) {
        TypeScriptSettings settings = TypeScriptSettings.from(
            context.getModel(),
            context.getSettings(),
            artifactType
        );
        execute(context, settings);
    }

    private void execute(PluginContext context, TypeScriptSettings settings) {
        if (settings.generateTypes() && !settings.isTypesOnly()) {
            // TODO: Combined mode (types alongside client/server) requires generating schemas over
            // the full connected-shape closure. Keep the mode set in settings so dispatch can be
            // enabled without changing the configuration model once that behavior is supported.
            throw new CodegenException(
                "Combined mode (types alongside client/server) is not yet supported. "
                    + "Use a single mode: [\"client\"], [\"server\"], or [\"types\"]."
            );
        }

        if (settings.isTypesOnly()) {
            executeTypesMode(context, settings);
        } else {
            executeServiceMode(context, settings);
        }
    }

    private void executeServiceMode(PluginContext context, TypeScriptSettings settings) {
        CodegenDirector<TypeScriptWriter, TypeScriptIntegration, TypeScriptCodegenContext, TypeScriptSettings> runner =
            newRunner(context, settings);

        runner.service(settings.getService());
        runner.performDefaultCodegenTransforms();

        // TODO: Not using createDedicatedInputsAndOutputs because it would break existing AWS SDKs.
        // Maybe it should be configurable so generic SDKs call this by default, but AWS SDKs can
        // opt-out of it via a setting.

        runner.run();
    }

    private void executeTypesMode(PluginContext context, TypeScriptSettings settings) {
        String closureId = settings.getClosure();
        if (closureId == null || closureId.isEmpty()) {
            throw new CodegenException(
                "The 'closure' setting is required when using types-only mode (modes: [\"types\"])."
            );
        }

        CodegenDirector<TypeScriptWriter, TypeScriptIntegration, TypeScriptCodegenContext, TypeScriptSettings> runner =
            newRunner(context, settings);

        runner.shapeClosure(closureId);
        runner.generateDataShapesOnly();
        // Without a service to disambiguate them, two shapes that share a (case-insensitive) name
        // across namespaces would generate colliding TypeScript types. Fail fast so the closure
        // author resolves the conflict with a rename rather than emitting uncompilable output.
        runner.requireCaseInsensitiveNames();
        runner.performDefaultCodegenTransforms();
        runner.run();
    }

    private CodegenDirector<TypeScriptWriter, TypeScriptIntegration, TypeScriptCodegenContext,
        TypeScriptSettings> newRunner(PluginContext context, TypeScriptSettings settings) {
        CodegenDirector<TypeScriptWriter, TypeScriptIntegration, TypeScriptCodegenContext, TypeScriptSettings> runner =
            new CodegenDirector<>();

        runner.directedCodegen(new DirectedTypeScriptCodegen());
        runner.integrationClass(TypeScriptIntegration.class);
        runner.fileManifest(context.getFileManifest());
        runner.model(context.getModel());
        runner.settings(settings);

        // Only add integrations if the integrations match the settings.
        // This uses {@link TypeScriptIntegration#matchesSettings}, which is a
        // Smithy internal API. This may be removed at any point.
        runner.integrationFinder(
            () -> () -> ServiceLoader.load(TypeScriptIntegration.class, CodegenDirector.class.getClassLoader())
                .stream()
                .map(Provider::get)
                .filter(integration -> {
                    boolean matchesSettings = integration.matchesSettings(settings);
                    if (!matchesSettings) {
                        LOGGER.fine(
                            () -> "Skipping TypeScript integration based on settings: "
                                + integration.name()
                        );
                    }
                    return matchesSettings;
                })
                .iterator()
        );

        return runner;
    }
}
