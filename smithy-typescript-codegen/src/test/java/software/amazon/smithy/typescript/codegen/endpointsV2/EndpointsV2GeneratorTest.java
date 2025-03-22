package software.amazon.smithy.typescript.codegen.endpointsV2;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenPlugin;

public class EndpointsV2GeneratorTest {
    @Test
    public void containsTrailingSemicolon() {
        MockManifest manifest = testEndpoints("endpoints.smithy");

        String ruleset = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/endpoint/ruleset.ts").get();

        assertThat(ruleset, containsString(
                "      },\n" +
                "      {\n" +
                "        \"documentation\": \"Fallback when region is unset\",\n" +
                "        \"conditions\": [\n" +
                "        ],\n" +
                "        \"error\": \"Region must be set to resolve a valid endpoint\",\n" +
                "        \"type\": \"error\",\n" +
                "      },\n" +
                "    ],\n" +
                "  }\n" +
                ";\n"));
    }

    @Test
    public void containsExtraContextParameter() {
        MockManifest manifest = testEndpoints("endpoints.smithy");

        String ruleset = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/endpoint/ruleset.ts").get();

        assertThat(ruleset, containsString(
                "      },\n" +
                "      \"Stage\": {\n" +
                "        \"type\": \"String\",\n" +
                "        \"required\": true,\n" +
                "        \"default\": \"production\",\n" +
                "      },\n"));

        String endpointParameters = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/endpoint/EndpointParameters.ts").get();

        assertThat(endpointParameters, containsString(
                "  return Object.assign(options, {\n" +
                "    stage: options.stage ?? \"production\",\n" +
                "    defaultSigningName: \"\",\n" +
                "  });\n"));
        assertThat(endpointParameters, containsString(
                "export interface ClientInputEndpointParameters {\n" +
                "  region?: string|Provider<string>;\n" +
                "  stage?: string|Provider<string>;\n" +
                "  endpoint?:"));
    }

    private MockManifest testEndpoints(String filename) {
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
                .pluginClassLoader(getClass().getClassLoader())
                .model(Model.assembler()
                        .addImport(getClass().getResource(filename))
                        .discoverModels()
                        .assemble()
                        .unwrap())
                .fileManifest(manifest)
                .settings(Node.objectNodeBuilder()
                        .withMember("service", Node.from("smithy.example#Example"))
                        .withMember("package", Node.from("example"))
                        .withMember("packageVersion", Node.from("1.0.0"))
                        .build())
                .build();

        new TypeScriptCodegenPlugin().execute(context);

        assertThat(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/endpoint/EndpointParameters.ts"),
                is(true));
        assertThat(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/endpoint/endpointResolver.ts"),
                is(true));

        String contents = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/endpoint/ruleset.ts").get();

        assertThat(contents, containsString("export const ruleSet: RuleSetObject"));

        return manifest;
    }
}
