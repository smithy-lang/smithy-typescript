package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static software.amazon.smithy.typescript.codegen.integration.DefaultReadmeGenerator.README_FILENAME;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.typescript.codegen.integration.DefaultReadmeGenerator;

class DefaultDefaultReadmeGeneratorTest {

    private TypeScriptSettings settings;
    private TypeScriptCodegenContext context;
    private MockManifest manifest;
    private SymbolProvider symbolProvider;
    private final Model model = Model.assembler()
        .addImport(getClass().getResource("simple-service-with-operation.smithy"))
        .assemble()
        .unwrap();

    @BeforeEach
    void setup() {
        settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .withMember("createDefaultReadme", Node.from(true))
                .build()
        );

        manifest = new MockManifest();
        symbolProvider = new SymbolVisitor(model, settings);
    }

    private TypeScriptCodegenContext createContext() {
        return TypeScriptCodegenContext.builder()
            .model(model)
            .settings(settings)
            .symbolProvider(symbolProvider)
            .fileManifest(manifest)
            .integrations(List.of(new DefaultReadmeGenerator()))
            .runtimePlugins(new ArrayList<>())
            .protocolGenerator(null)
            .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
            .writerDelegator(new TypeScriptDelegator(manifest, symbolProvider))
            .build();
    }

    @Test
    void expectDefaultFileWrittenForClientSDK() {
        context = createContext();
        new DefaultReadmeGenerator().customize(context);
        context.writerDelegator().flushWriters();
        Assertions.assertTrue(manifest.hasFile("/" + README_FILENAME));
        String readme = manifest.getFileString("/" + README_FILENAME).get();
        assertThat(readme, containsString("SDK for JavaScript Example Client"));
    }

    @Test
    void expectDefaultFileWrittenForServerSDK() {
        settings.setArtifactType(TypeScriptSettings.ArtifactType.SSDK);
        context = createContext();
        new DefaultReadmeGenerator().customize(context);
        context.writerDelegator().flushWriters();
        Assertions.assertTrue(manifest.hasFile("/" + README_FILENAME));
        String readme = manifest.getFileString("/" + README_FILENAME).get();
        assertThat(readme, containsString("JavaScript Server SDK for Example"));
    }
}
