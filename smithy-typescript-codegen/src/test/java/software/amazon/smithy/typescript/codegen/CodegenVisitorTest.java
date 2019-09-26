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
        testErrorStructureCodegen("error-test-empty.smithy");
    }

    @Test
    public void properlyGeneratesOptionalMessageMemberOfException() {
        testErrorStructureCodegen("error-test-optional-message.smithy");
    }

    @Test
    public void properlyGeneratesRequiredMessageMemberOfException() {
        testErrorStructureCodegen("error-test-required-message.smithy");
    }

    public void testErrorStructureCodegen(String file) {
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
        String contents = manifest.getFileString("/types/smithy/example/index.ts").get();

        assertThat(contents, containsString("export class Err extends $SmithyException {\n"
                                            + "  constructor(args: {\n"
                                            + "    $service: string;\n"
                                            + "    message?: string;\n"
                                            + "  }) {\n"
                                            + "    super({\n"
                                            + "      message: args.message || \"\",\n"
                                            + "      id: \"smithy.example#Err\",\n"
                                            + "      name: \"Err\",\n"
                                            + "      fault: \"client\",\n"
                                            + "      service: args.$service,\n"
                                            + "    });\n"
                                            + "  }\n"
                                            + "}"));
    }
}
