package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;

public class CodegenVisitorTest {
    @Test
    public void properlyGeneratesEmptyMessageMemberOfException() {
        testErrorStructureCodegen("error-test-empty.smithy",
                                  "export interface Err extends _smithy.SmithyException {\n"
                                  + "  __type: \"smithy.example#Err\";\n"
                                  + "  $name: \"Err\";\n"
                                  + "  $fault: \"client\";\n"
                                  + "}");
    }

    @Test
    public void properlyGeneratesOptionalMessageMemberOfException() {
        testErrorStructureCodegen("error-test-optional-message.smithy",
                                  "export interface Err extends _smithy.SmithyException {\n"
                                  + "  __type: \"smithy.example#Err\";\n"
                                  + "  $name: \"Err\";\n"
                                  + "  $fault: \"client\";\n"
                                  + "  message?: string;\n"
                                  + "}");
    }

    @Test
    public void properlyGeneratesRequiredMessageMemberOfException() {
        testErrorStructureCodegen("error-test-required-message.smithy",
                                  "export interface Err extends _smithy.SmithyException {\n"
                                  + "  __type: \"smithy.example#Err\";\n"
                                  + "  $name: \"Err\";\n"
                                  + "  $fault: \"client\";\n"
                                  + "  message: string | undefined;\n"
                                  + "}");
    }

    public void testErrorStructureCodegen(String file, String expectedType) {
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
        String contents = manifest.getFileString("/models/index.ts").get();

        assertThat(contents, containsString(expectedType));
        assertThat(contents, containsString("namespace Err {\n"
                                            + "  export const ID = \"smithy.example#Err\";\n"
                                            + "  export function isa(o: any): o is Err {\n"
                                            + "    return _smithy.isa(o, ID);\n"
                                            + "  }\n"
                                            + "}"));
    }

    @Test
    public void generatesServiceAndCommandShapes() {
        // TODO
    }
}
