package software.amazon.smithy.typescript.codegen;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static software.amazon.smithy.typescript.codegen.ReadmeGenerator.README_FILENAME;

class DefaultReadmeGeneratorTest {

    private TypeScriptWriter writer;
    private TypeScriptSettings settings;
    private final Model model = Model.assembler()
            .addImport(getClass().getResource("simple-service-with-operation.smithy"))
            .assemble()
            .unwrap();


    @BeforeEach
    void setup() {
        writer = new TypeScriptWriter(README_FILENAME);
        settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .withMember("enableDefaultReadme", Node.from(true))
                .build());
    }

    @Test
    void expectDefaultFileWrittenForClientSDK() {
        ReadmeGenerator.generateDefault(settings, model, this::writerFactory);

        assertThat(writer.toString(), containsString("SDK for JavaScript Example Client"));
    }

    @Test
    void expectDefaultFileWrittenForServerSDK() {
        settings.setArtifactType(TypeScriptSettings.ArtifactType.SSDK);

        ReadmeGenerator.generateDefault(settings, model, this::writerFactory);

        assertThat(writer.toString(), containsString("SDK for JavaScript Example Server"));
    }

    private TypeScriptWriter writerFactory(String filename) {
        return writer;
    }
}