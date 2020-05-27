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
                                  "export interface Err extends __SmithyException, $MetadataBearer {\n"
                                  + "  name: \"Err\";\n"
                                  + "  $fault: \"client\";\n"
                                  + "}");
    }

    @Test
    public void properlyGeneratesOptionalMessageMemberOfException() {
        testErrorStructureCodegen("error-test-optional-message.smithy",
                                  "export interface Err extends __SmithyException, $MetadataBearer {\n"
                                  + "  name: \"Err\";\n"
                                  + "  $fault: \"client\";\n"
                                  + "  message?: string;\n"
                                  + "}");
    }

    @Test
    public void properlyGeneratesRequiredMessageMemberOfException() {
        testErrorStructureCodegen("error-test-required-message.smithy",
                                  "export interface Err extends __SmithyException, $MetadataBearer {\n"
                                  + "  name: \"Err\";\n"
                                  + "  $fault: \"client\";\n"
                                  + "  message: string | undefined;\n"
                                  + "}");
    }

    @Test
    public void filtersSensitiveSimpleShape() {
        testStructureCodegen("test-sensitive-simple-shape.smithy",
                                "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.password && { password:\n"
                                + "      SENSITIVE_STRING\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void callsFilterForStructureWithSensitiveData() {
        testStructureCodegen("test-structure-with-sensitive-data.smithy",
                                "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.foo && { foo:\n"
                                + "      User.filterSensitiveLog(obj.foo)\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void callsFilterInStructureWithSensitiveData() {
        testStructureCodegen("test-structure-with-sensitive-data.smithy",
                                "  export const filterSensitiveLog = (obj: User): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.password && { password:\n"
                                + "      SENSITIVE_STRING\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void filtersSensitiveStructure() {
        testStructureCodegen("test-sensitive-structure.smithy",
                                "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.foo && { foo:\n"
                                + "      SENSITIVE_STRING\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void filtersSensitiveMemberPointingToStructure() {
        testStructureCodegen("test-sensitive-member-pointing-to-structure.smithy",
                                "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.sensitiveFoo && { sensitiveFoo:\n"
                                + "      SENSITIVE_STRING\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void callsFilterForListWithSensitiveData() {
        testStructureCodegen("test-list-with-sensitive-data.smithy",
                                "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.foo && { foo:\n"
                                + "      obj.foo.map(\n"
                                + "        item =>\n"
                                + "        User.filterSensitiveLog(item)\n"
                                + "      )\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void callsFilterInListWithSensitiveData() {
        testStructureCodegen("test-list-with-sensitive-data.smithy",
                                "  export const filterSensitiveLog = (obj: User): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.password && { password:\n"
                                + "      SENSITIVE_STRING\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void filtersSensitiveList() {
        testStructureCodegen("test-sensitive-list.smithy",
                                "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.foo && { foo:\n"
                                + "      SENSITIVE_STRING\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void filtersSensitiveMemberPointingToList() {
        testStructureCodegen("test-sensitive-member-pointing-to-list.smithy",
                                "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.sensitiveFoo && { sensitiveFoo:\n"
                                + "      SENSITIVE_STRING\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void callsFilterForMapWithSensitiveData() {
        testStructureCodegen("test-map-with-sensitive-data.smithy",
                                "  export const filterSensitiveLog = (obj: User): any => ({\n"
                                + "    ...obj,\n"
                                + "    ...(obj.password && { password:\n"
                                + "      SENSITIVE_STRING\n"
                                + "    }),\n"
                                + "  })\n");
    }

    @Test
    public void callsFilterInMapWithSensitiveData() {
        testStructureCodegen("test-map-with-sensitive-data.smithy",
                            "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                            + "    ...obj,\n"
                            + "    ...(obj.foo && { foo:\n"
                            + "      Object.entries(obj.foo).reduce((acc: any, [key, value]: [string, User]) => ({\n"
                            + "        ...acc,\n"
                            + "        [key]:\n"
                            + "          User.filterSensitiveLog(value)\n"
                            + "        ,\n"
                            + "      }), {})\n"
                            + "    }),\n"
                            + "  })\n");
    }

    @Test
    public void filtersSensitiveMap() {
        testStructureCodegen("test-sensitive-map.smithy",
                            "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                            + "    ...obj,\n"
                            + "    ...(obj.foo && { foo:\n"
                            + "      SENSITIVE_STRING\n"
                            + "    }),\n"
                            + "  })\n");
    }

    @Test
    public void filtersSensitiveMemberPointingToMap() {
        testStructureCodegen("test-sensitive-member-pointing-to-map.smithy",
                            "  export const filterSensitiveLog = (obj: GetFooInput): any => ({\n"
                            + "    ...obj,\n"
                            + "    ...(obj.sensitiveFoo && { sensitiveFoo:\n"
                            + "      SENSITIVE_STRING\n"
                            + "    }),\n"
                            + "  })\n");
    }

    private String testStructureCodegen(String file, String expectedType) {
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
        return contents;
    }

    private void testErrorStructureCodegen(String file, String expectedType) {
        String contents = testStructureCodegen(file, expectedType);

        assertThat(contents, containsString("as __isa"));
        assertThat(contents, containsString("as __SmithyException"));
        assertThat(contents, containsString("namespace Err {"));
        assertThat(contents, containsString("  export const isa = (o: any): o is Err => "
                                            + "__isa(o, \"Err\");\n"));
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

        assertThat(output, containsString("as __isa"));
        assertThat(output, containsString("export interface Bar {"));
        assertThat(output, containsString("__type?: \"Bar\";"));
        assertThat(output, containsString("foo?: string;"));
        assertThat(output, containsString("export namespace Bar {"));
        assertThat(output, containsString(
                "export const isa = (o: any): o is Bar => __isa(o, \"Bar\");"));
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

        assertThat(output, containsString("export interface Bar {"));
    }
}
