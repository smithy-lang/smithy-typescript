package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

public class RuntimeConfigGeneratorTest {
    @Test
    public void expandsRuntimeConfigFile() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        MockManifest manifest = new MockManifest();

        List<TypeScriptIntegration> integrations = new ArrayList<>();
        integrations.add(new TypeScriptIntegration() {
            @Override
            public void addRuntimeConfigValues(
                    TypeScriptSettings settings,
                    Model model,
                    SymbolProvider symbolProvider,
                    TypeScriptWriter writer,
                    LanguageTarget target
            ) {
                writer.write("syn: 'ack',");
            }
        });

        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
        SymbolProvider symbolProvider = TypeScriptCodegenPlugin.createSymbolProvider(model);
        TypeScriptDelegator delegator = new TypeScriptDelegator(
                settings, model, manifest, symbolProvider, integrations);
        RuntimeConfigGenerator generator = new RuntimeConfigGenerator(
                settings, model, symbolProvider, "undefined", delegator, integrations);
        generator.generate(LanguageTarget.NODE);
        generator.generate(LanguageTarget.BROWSER);
        generator.generate(LanguageTarget.SHARED);
        delegator.flushWriters();

        Assertions.assertTrue(manifest.hasFile("runtimeConfig.ts"));
        Assertions.assertTrue(manifest.hasFile("runtimeConfig.browser.ts"));
        Assertions.assertTrue(manifest.hasFile("runtimeConfig.shared.ts"));

        // Does the runtimeConfig.shared.ts file expand the template properties properly?
        String runtimeConfigSharedContents = manifest.getFileString("runtimeConfig.shared.ts").get();
        assertThat(runtimeConfigSharedContents, containsString("protocol: \"undefined\","));
        assertThat(runtimeConfigSharedContents, containsString("apiVersion: \"1.0.0\","));
        assertThat(runtimeConfigSharedContents, containsString("syn: 'ack',"));

        // Does the runtimeConfig.ts file expand the template properties properly?
        String runtimeConfigContents = manifest.getFileString("runtimeConfig.ts").get();
        assertThat(runtimeConfigContents,
                   containsString("import { ClientDefaults } from \"./ExampleClient\";"));
        assertThat(runtimeConfigContents, containsString("syn: 'ack',"));

        // Does the runtimeConfig.browser.ts file expand the template properties properly?
        String runtimeConfigBrowserContents = manifest.getFileString("runtimeConfig.ts").get();
        assertThat(runtimeConfigBrowserContents,
                   containsString("import { ClientDefaults } from \"./ExampleClient\";"));
        assertThat(runtimeConfigContents, containsString("syn: 'ack',"));
    }
}
