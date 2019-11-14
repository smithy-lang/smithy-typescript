package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.loader.ModelAssembler;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.StructureShape;

public class StructureGeneratorTest {
    @Test
    public void properlyGeneratesEmptyMessageMemberOfException() {
        testErrorStructureCodegen("error-test-empty.smithy",
                                  "export interface Err extends _smithy.SmithyException {\n"
                                  + "  __type: \"Err\";\n"
                                  + "  $fault: \"client\";\n"
                                  + "}");
    }

    @Test
    public void properlyGeneratesOptionalMessageMemberOfException() {
        testErrorStructureCodegen("error-test-optional-message.smithy",
                                  "export interface Err extends _smithy.SmithyException {\n"
                                  + "  __type: \"Err\";\n"
                                  + "  $fault: \"client\";\n"
                                  + "  message?: string;\n"
                                  + "}");
    }

    @Test
    public void properlyGeneratesRequiredMessageMemberOfException() {
        testErrorStructureCodegen("error-test-required-message.smithy",
                                  "export interface Err extends _smithy.SmithyException {\n"
                                  + "  __type: \"Err\";\n"
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
                                            + "  export function isa(o: any): o is Err {\n"
                                            + "    return _smithy.isa(o, \"Err\");\n"
                                            + "  }\n"
                                            + "}"));
    }

    @Test
    public void generatesNonErrorStructures() {
        StructureShape struct = createNonErrorStructure();
        ModelAssembler assembler = Model.assembler().addShape(struct);
        struct.getAllMembers().values().forEach(assembler::addShape);
        Model model = assembler.assemble().unwrap();

        TypeScriptWriter writer = new TypeScriptWriter("./foo");
        new StructureGenerator(model, TypeScriptCodegenPlugin.createSymbolProvider(model), writer, struct).run();
        String output = writer.toString();

        assertThat(output, containsString("export interface Bar {"));
        assertThat(output, containsString("__type?: \"Bar\";"));
        assertThat(output, containsString("foo?: string;"));
        assertThat(output, containsString("export namespace Bar {"));
        assertThat(output, containsString(
                "export function isa(o: any): o is Bar {\n"
                + "    return _smithy.isa(o, \"Bar\");\n"
                + "  }"));
    }

    private StructureShape createNonErrorStructure() {
        return StructureShape.builder()
                .id("com.foo#Bar")
                .addMember(MemberShape.builder().id("com.foo#Bar$foo").target("smithy.api#String").build())
                .build();
    }

    @Test
    public void generatesNonErrorStructuresThatExtendOtherInterfaces() {
        StructureShape struct = createNonErrorStructure();
        ModelAssembler assembler = Model.assembler().addShape(struct);
        struct.getAllMembers().values().forEach(assembler::addShape);
        OperationShape operation = OperationShape.builder().id("com.foo#Operation").output(struct).build();
        assembler.addShape(operation);
        Model model = assembler.assemble().unwrap();

        TypeScriptWriter writer = new TypeScriptWriter("./foo");
        new StructureGenerator(model, TypeScriptCodegenPlugin.createSymbolProvider(model), writer, struct).run();
        String output = writer.toString();

        assertThat(output, containsString("export interface Bar extends $MetadataBearer {"));
    }
}
