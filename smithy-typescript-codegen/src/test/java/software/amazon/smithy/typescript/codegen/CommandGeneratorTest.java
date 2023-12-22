package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;

public class CommandGeneratorTest {
    @Test
    public void addsCommandSpecificPlugins() {
        testCommmandCodegen(
            "output-structure.smithy",
            "getSerdePlugin(config, this.serialize, this.deserialize)"
        );
    }

    @Test
    public void writesSerializer() {
        testCommmandCodegen(
            "output-structure.smithy",
            ".ser("
        );
    }

    @Test
    public void writesDeserializer() {
        testCommmandCodegen(
            "output-structure.smithy",
        ".de("
        );
    }

    private void testCommmandCodegen(String file, String expectedType) {
        Model model = Model.assembler()
                .addImport(getClass().getResource(file))
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
        String contents = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "//commands/GetFooCommand.ts").get();

        assertThat(contents, containsString("as __MetadataBearer"));
        assertThat(contents, containsString(expectedType));
    }
}
