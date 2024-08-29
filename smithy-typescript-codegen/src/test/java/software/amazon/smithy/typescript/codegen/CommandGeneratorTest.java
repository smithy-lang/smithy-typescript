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
            new String[] {"getSerdePlugin(config, this.serialize, this.deserialize)"}
        );
    }

    @Test
    public void writesSerializer() {
        testCommmandCodegen(
            "output-structure.smithy",
            new String[] {".ser("}
        );
    }

    @Test
    public void writesDeserializer() {
        testCommmandCodegen(
            "output-structure.smithy",
            new String[] {".de("}
        );
    }

    @Test
    public void writesOperationContextParamValues() {
        testCommmandCodegen(
            "endpointsV2/endpoints-operation-context-params.smithy",
            new String[] {
                "opContextParamIdentifier: { type: \"operationContextParams\", name: this.input.fooString }",
                "opContextParamSubExpression: { type: \"operationContextParams\", name: this.input.fooObj.bar }",
                "opContextParamWildcardExpressionList: { type: \"operationContextParams\", name: this.input.fooList.map(obj => obj) }",
                "opContextParamWildcardExpressionListObj: { type: \"operationContextParams\", name: this.input.fooListObj.map(obj => obj.key) }",
                "opContextParamWildcardExpressionHash: { type: \"operationContextParams\", name: Object.values(this.input.fooObjObj).map(obj => obj.bar) }",
            }
        );
    }

    private void testCommmandCodegen(String filename, String[] expectedTypeArray) {
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
        String contents = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "//commands/GetFooCommand.ts").get();

        assertThat(contents, containsString("as __MetadataBearer"));
        for (String expectedType : expectedTypeArray) {
            assertThat(contents, containsString(expectedType));
        }
    }
}
