package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

public class IndexGeneratorTest {

    @Test
    public void writesIndex() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service-with-operation.smithy")).assemble().unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
        SymbolProvider symbolProvider = TypeScriptCodegenPlugin.createSymbolProvider(model, settings);
        MockManifest manifest = new MockManifest();
        List<TypeScriptIntegration> integrations = new ArrayList<>();
        integrations.add(new TypeScriptIntegration() {
            @Override
            public void writeAdditionalExports(
                    TypeScriptSettings settings,
                    Model model,
                    SymbolProvider symbolProvider,
                    TypeScriptWriter writer
            ) {
                writer.write("export * from $S;", "./foo");
            }
        });

        IndexGenerator.writeIndex(settings, model, symbolProvider, manifest, integrations, null);

        String contents = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/index.ts").get();
        assertThat(contents, containsString("export * from \"./Example\";"));
        assertThat(contents, containsString("export * from \"./ExampleClient\";"));
        assertThat(contents, containsString("export * from \"./commands/GetFooCommand\";"));
        assertThat(contents, containsString("export * from \"./models/index\";"));
        assertThat(contents, containsString("export * from \"./foo\";"));
    }
}
