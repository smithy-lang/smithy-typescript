package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;

public class TypeScriptCodegenPluginTest {
    @Test
    public void generatesRuntimeConfigFiles() {
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .assemble()
                .unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
                .model(model)
                .fileManifest(manifest)
                .settings(Node.objectNodeBuilder()
                                  .withMember("service", Node.from("smithy.example#Example"))
                                  .withMember("package", Node.from("example"))
                                  .withMember("packageVersion", Node.from("1.0.0"))
                                  .build())
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
        assertThat(packageJson.expectObjectMember("browser").getStringMember("./dist-es/runtimeConfig"),
                   equalTo(Optional.of(Node.from("./dist-es/runtimeConfig.browser"))));
    }

    @Test
    public void decoratesSymbolProvider() {
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .assemble()
                .unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
                .model(model)
                .fileManifest(manifest)
                .pluginClassLoader(getClass().getClassLoader())
                .settings(Node.objectNodeBuilder()
                        .withMember("service", Node.from("smithy.example#Example"))
                        .withMember("package", Node.from("example"))
                        .withMember("packageVersion", Node.from("1.0.0"))
                        .withMember("__customServiceName", "Foo")
                        .build())
                .build();

        new TypeScriptCodegenPlugin().execute(context);

        assertTrue(manifest.hasFile("Foo.ts"));
        assertThat(manifest.getFileString("Foo.ts").get(), containsString("export class Foo"));
    }

    @Test
    public void generatesServiceClients() {
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .assemble()
                .unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
                .model(model)
                .fileManifest(manifest)
                .pluginClassLoader(getClass().getClassLoader())
                .settings(Node.objectNodeBuilder()
                        .withMember("package", Node.from("example"))
                        .withMember("packageVersion", Node.from("1.0.0"))
                        .build())
                .build();
        new TypeScriptCodegenPlugin().execute(context);

        assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/Example.ts"));
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/Example.ts").get(),
                   containsString("export class Example extends ExampleClient"));

        assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/ExampleClient.ts"));
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/ExampleClient.ts").get(), containsString("export class ExampleClient"));
    }

    @Test
    public void invokesOnWriterCustomizations() {
        // TODO
    }
}
