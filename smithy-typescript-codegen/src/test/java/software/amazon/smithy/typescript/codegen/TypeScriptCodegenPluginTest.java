/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.build.SmithyBuildPlugin;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;

public class TypeScriptCodegenPluginTest {

    @Test
    public void generatesRuntimeConfigFiles() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(manifest)
            .settings(
                Node.objectNodeBuilder()
                    .withMember("service", Node.from("smithy.example#Example"))
                    .withMember("package", Node.from("example"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .build()
            )
            .build();

        new TypeScriptCodegenPlugin().execute(context);

        // Did we generate the runtime config files?
        // note that asserting the contents of runtime config files is handled in its own unit tests.
        assertTrue(manifest.hasFile("package.json"));
        assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.browser.ts"));
        assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.ts"));
        assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/index.ts"));

        // Does the package.json file point to the runtime config?
        String packageJsonContents = manifest.getFileString("package.json").get();
        ObjectNode packageJson = Node.parse(packageJsonContents).expectObjectNode();
        assertThat(
            packageJson.expectObjectMember("browser").getStringMember("./dist-es/runtimeConfig"),
            equalTo(Optional.of(Node.from("./dist-es/runtimeConfig.browser")))
        );
    }

    @Test
    public void decoratesSymbolProvider() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(manifest)
            .pluginClassLoader(getClass().getClassLoader())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("service", Node.from("smithy.example#Example"))
                    .withMember("package", Node.from("example"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("__customServiceName", "Foo")
                    .build()
            )
            .build();

        new TypeScriptCodegenPlugin().execute(context);

        assertTrue(manifest.hasFile("Foo.ts"));
        assertThat(manifest.getFileString("Foo.ts").get(), containsString("export class Foo"));
    }

    @Test
    public void generatesServiceClients() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(manifest)
            .pluginClassLoader(getClass().getClassLoader())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("package", Node.from("example"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .build()
            )
            .build();
        new TypeScriptCodegenPlugin().execute(context);

        assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/Example.ts"));
        assertThat(
            manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/Example.ts").get(),
            containsString("export class Example extends ExampleClient")
        );

        assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/ExampleClient.ts"));
        assertThat(
            manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/ExampleClient.ts").get(),
            containsString("export class ExampleClient")
        );
    }

    @Test
    public void generatesServerFromUnifiedMode() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(manifest)
            .settings(
                Node.objectNodeBuilder()
                    .withMember("package", Node.from("example"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("server"))
                    .withMember("disableDefaultValidation", Node.from(true))
                    .build()
            )
            .build();

        new TypeScriptCodegenPlugin().execute(context);

        assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/server/ExampleService.ts"));
        assertFalse(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/ExampleClient.ts"));
    }

    @Test
    public void invokesOnWriterCustomizations() {
        // TODO
    }

    @Test
    public void generatesTypesFromShapeClosure() {
        Model model = Model.assembler()
            .addImport(getClass().getResource("types-closure.smithy"))
            // The closure includes this namespace, so directed codegen must defensively filter
            // the service shape rather than treating its presence as service-mode configuration.
            .addImport(getClass().getResource("simple-service.smithy"))
            .assemble()
            .unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(manifest)
            .pluginClassLoader(getClass().getClassLoader())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("package", Node.from("example-types"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("types"))
                    .withMember("closure", Node.from("smithy.example#types"))
                    .build()
            )
            .build();

        new TypeScriptCodegenPlugin().execute(context);

        // Data shapes in the closure are generated.
        assertTrue(
            manifest.getFiles().stream().anyMatch(p -> p.toString().contains("models")),
            "expected generated model files"
        );
        String models = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/models/models_0.ts").get();
        assertThat(models, containsString("interface Widget"));
        assertThat(models, containsString("interface Dimensions"));

        // Schemas are generated for types-only packages, with actual schema content
        // (writeErrors always emits the registry export, so check more than existence).
        assertTrue(
            manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/schemas/schemas_0.ts"),
            "expected generated schemas"
        );
        String schemas = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/schemas/schemas_0.ts").get();
        assertThat(schemas, containsString("Widget"));
        assertThat(schemas, containsString("Dimensions"));
        assertThat(schemas, containsString("export const errorTypeRegistries"));
        assertThat(
            manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/index.ts").get(),
            containsString("export * from \"./schemas/schemas_0\";")
        );
        // No synthetic base-exception schema leaks in without a service.
        assertThat(schemas, not(containsString("ServiceException$")));

        // No service/client artifacts are generated in types mode.
        assertFalse(
            manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/index.ts")
                && manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/index.ts").get().contains("Client")
        );
        assertThat(manifest.getFiles().toString(), not(containsString("Client.ts")));
    }

    @Test
    public void appliesClosureRenamesToGeneratedTypes() {
        Model model = Model.assembler()
            .addImport(getClass().getResource("types-closure-rename.smithy"))
            .assemble()
            .unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(manifest)
            .pluginClassLoader(getClass().getClassLoader())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("package", Node.from("example-types"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("types"))
                    .withMember("closure", Node.from("smithy.example#types"))
                    .build()
            )
            .build();

        new TypeScriptCodegenPlugin().execute(context);

        String models = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/models/models_0.ts").get();
        // The renamed shape's own interface uses the closure-declared name...
        assertThat(models, containsString("export interface RenamedDimensions {"));
        assertThat(models, not(containsString("interface Dimensions")));
        // ...and members referencing it pick up the rename too.
        assertThat(models, containsString("dimensions?: RenamedDimensions | undefined;"));
        // Unrenamed shapes are unaffected.
        assertThat(models, containsString("export interface Widget {"));

        // Renamed error shapes generate their class under the renamed name...
        String errors = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/models/errors.ts").get();
        assertThat(errors, containsString("export class RenamedWidgetError extends __BaseException {"));
        assertThat(errors, not(containsString("class WidgetError")));
        // ...and the schema imports and registers the renamed constructor, not the raw shape name.
        String schemas = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/schemas/schemas_0.ts").get();
        assertThat(schemas, containsString("RenamedWidgetError"));
        assertThat(schemas, not(containsString("import { WidgetError }")));
    }

    @Test
    public void generatesThrowableErrorClassInTypesMode() {
        Model model = Model.assembler()
            .addImport(getClass().getResource("types-closure-error.smithy"))
            .assemble()
            .unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(manifest)
            .pluginClassLoader(getClass().getClassLoader())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("package", Node.from("example-types"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("types"))
                    .withMember("closure", Node.from("smithy.example#types"))
                    .build()
            )
            .build();

        new TypeScriptCodegenPlugin().execute(context);

        String errors = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/models/errors.ts").get();
        // The error extends the generic ServiceException from @smithy/core, not a service-specific base.
        assertThat(errors, containsString("ServiceException as __BaseException,"));
        assertThat(errors, containsString("from \"@smithy/core/client\";"));
        assertThat(errors, containsString("export class WidgetError extends __BaseException {"));
        assertThat(errors, containsString("readonly $fault = \"client\" as const;"));
        // No service artifacts leak into types mode.
        assertFalse(manifest.hasFile("README.md"), "types mode must not generate a service README");
    }

    @Test
    public void rejectsCrossNamespaceNameCollisionInTypesMode() {
        Model model = Model.assembler()
            .addImport(getClass().getResource("types-closure-collision-a.smithy"))
            .addImport(getClass().getResource("types-closure-collision-b.smithy"))
            .assemble()
            .unwrap();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(new MockManifest())
            .pluginClassLoader(getClass().getClassLoader())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("package", Node.from("example-types"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("types"))
                    .withMember("closure", Node.from("smithy.example#types"))
                    .build()
            )
            .build();

        // smithy.a#Widget and smithy.b#Widget collide with no rename to disambiguate them.
        CodegenException e = assertThrows(
            CodegenException.class,
            () -> new TypeScriptCodegenPlugin().execute(context)
        );
        // Assert it fails for the collision specifically, not some unrelated reason.
        assertThat(e.getMessage(), containsString("conflict"));
    }

    @Test
    public void typesModeRequiresClosure() {
        Model model = Model.assembler().addImport(getClass().getResource("types-closure.smithy")).assemble().unwrap();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(new MockManifest())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("package", Node.from("example-types"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("types"))
                    .build()
            )
            .build();

        CodegenException e = assertThrows(
            CodegenException.class,
            () -> new TypeScriptCodegenPlugin().execute(context)
        );
        assertThat(e.getMessage(), containsString("'closure' setting is required"));
    }

    @Test
    public void rejectsClosureOutsideTypesMode() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(new MockManifest())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("service", Node.from("smithy.example#Example"))
                    .withMember("package", Node.from("example"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("client"))
                    .withMember("closure", Node.from("smithy.example#types"))
                    .build()
            )
            .build();

        // A shape closure would be silently ignored in client/server mode; it must be rejected.
        CodegenException e = assertThrows(
            CodegenException.class,
            () -> new TypeScriptCodegenPlugin().execute(context)
        );
        assertThat(e.getMessage(), containsString("'closure' setting can only be used in types mode"));
    }

    @Test
    public void rejectsCombinedClientAndServerModes() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(new MockManifest())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("service", Node.from("smithy.example#Example"))
                    .withMember("package", Node.from("example"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("client", "server"))
                    .build()
            )
            .build();

        CodegenException e = assertThrows(
            CodegenException.class,
            () -> new TypeScriptCodegenPlugin().execute(context)
        );
        assertThat(e.getMessage(), containsString("cannot be combined"));
    }

    @Test
    public void rejectsCombinedTypesAndServiceModes() {
        Model model = Model.assembler()
            .addImport(getClass().getResource("types-closure.smithy"))
            .addImport(getClass().getResource("simple-service.smithy"))
            .assemble()
            .unwrap();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(new MockManifest())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("service", Node.from("smithy.example#Example"))
                    .withMember("package", Node.from("example"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("client", "types"))
                    .withMember("closure", Node.from("smithy.example#types"))
                    .build()
            )
            .build();

        CodegenException e = assertThrows(
            CodegenException.class,
            () -> new TypeScriptCodegenPlugin().execute(context)
        );
        assertThat(e.getMessage(), containsString("not yet supported"));
    }

    @Test
    @SuppressWarnings("deprecation")
    public void specializedPluginsRejectModes() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(new MockManifest())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("service", Node.from("smithy.example#Example"))
                    .withMember("package", Node.from("example"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("modes", Node.fromStrings("types"))
                    .build()
            )
            .build();

        List<SmithyBuildPlugin> plugins = List.of(
            new TypeScriptClientCodegenPlugin(),
            new TypeScriptServerCodegenPlugin(),
            new TypeScriptSSDKCodegenPlugin()
        );
        for (SmithyBuildPlugin plugin : plugins) {
            CodegenException e = assertThrows(CodegenException.class, () -> plugin.execute(context));
            assertThat(e.getMessage(), containsString("only supported by the unified"));
        }
    }
}
