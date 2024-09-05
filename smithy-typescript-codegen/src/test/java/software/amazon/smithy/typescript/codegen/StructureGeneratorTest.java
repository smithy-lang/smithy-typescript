package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.loader.ModelAssembler;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings.RequiredMemberMode;

public class StructureGeneratorTest {
    @Test
    public void properlyGeneratesEmptyMessageMemberOfException() {
        testErrorStructureCodegen("error-test-empty.smithy",
                "export class Err extends __BaseException {\n"
                        + "  readonly name: \"Err\" = \"Err\";\n"
                        + "  readonly $fault: \"client\" = \"client\";\n"
                        + "  /**\n"
                        + "   * @internal\n"
                        + "   */\n"
                        + "  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {\n"
                        + "    super({\n"
                        + "      name: \"Err\",\n"
                        + "      $fault: \"client\",\n"
                        + "      ...opts\n"
                        + "    });\n"
                        + "    Object.setPrototypeOf(this, Err.prototype);\n"
                        + "  }\n"
                        + "}\n");
    }

    @Test
    public void properlyGeneratesOptionalMessageMemberOfException() {
        testErrorStructureCodegen("error-test-optional-message.smithy",
                "export class Err extends __BaseException {\n"
                        + "  readonly name: \"Err\" = \"Err\";\n"
                        + "  readonly $fault: \"client\" = \"client\";\n"
                        + "  /**\n"
                        + "   * @internal\n"
                        + "   */\n"
                        + "  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {\n"
                        + "    super({\n"
                        + "      name: \"Err\",\n"
                        + "      $fault: \"client\",\n"
                        + "      ...opts\n"
                        + "    });\n"
                        + "    Object.setPrototypeOf(this, Err.prototype);\n"
                        + "  }\n"
                        + "}\n");
    }

    @Test
    public void properlyGeneratesRequiredMessageMemberOfException() {
        testErrorStructureCodegen("error-test-required-message.smithy",
                "export class Err extends __BaseException {\n"
                        + "  readonly name: \"Err\" = \"Err\";\n"
                        + "  readonly $fault: \"client\" = \"client\";\n"
                        + "  /**\n"
                        + "   * @internal\n"
                        + "   */\n"
                        + "  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {\n"
                        + "    super({\n"
                        + "      name: \"Err\",\n"
                        + "      $fault: \"client\",\n"
                        + "      ...opts\n"
                        + "    });\n"
                        + "    Object.setPrototypeOf(this, Err.prototype);\n"
                        + "  }\n"
                        + "}\n");
    }

    @Test
    public void properlyGeneratesOptionalNonMessageMemberOfException() {
        testErrorStructureCodegen("error-test-optional-member-no-message.smithy",
                "export class Err extends __BaseException {\n"
                        + "  readonly name: \"Err\" = \"Err\";\n"
                        + "  readonly $fault: \"client\" = \"client\";\n"
                        + "  foo?: string;\n"
                        + "  /**\n"
                        + "   * @internal\n"
                        + "   */\n"
                        + "  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {\n"
                        + "    super({\n"
                        + "      name: \"Err\",\n"
                        + "      $fault: \"client\",\n"
                        + "      ...opts\n"
                        + "    });\n"
                        + "    Object.setPrototypeOf(this, Err.prototype);\n"
                        + "    this.foo = opts.foo;\n"
                        + "  }\n"
                        + "}\n");
    }

    @Test
    public void properlyGeneratesRequiredNonMessageMemberOfException() {
        testErrorStructureCodegen("error-test-required-member-no-message.smithy",
                "export class Err extends __BaseException {\n"
                        + "  readonly name: \"Err\" = \"Err\";\n"
                        + "  readonly $fault: \"client\" = \"client\";\n"
                        + "  foo: string | undefined;\n"
                        + "  /**\n"
                        + "   * @internal\n"
                        + "   */\n"
                        + "  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {\n"
                        + "    super({\n"
                        + "      name: \"Err\",\n"
                        + "      $fault: \"client\",\n"
                        + "      ...opts\n"
                        + "    });\n"
                        + "    Object.setPrototypeOf(this, Err.prototype);\n"
                        + "    this.foo = opts.foo;\n"
                        + "  }\n"
                        + "}\n");
    }

    @Test
    public void generatesEmptyRetryableTrait() {
        testErrorStructureCodegen("error-test-retryable.smithy",
                "export class Err extends __BaseException {\n"
                        + "  readonly name: \"Err\" = \"Err\";\n"
                        + "  readonly $fault: \"client\" = \"client\";\n"
                        + "  $retryable = {\n"
                        + "  };\n"
                        + "  /**\n"
                        + "   * @internal\n"
                        + "   */\n"
                        + "  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {\n"
                        + "    super({\n"
                        + "      name: \"Err\",\n"
                        + "      $fault: \"client\",\n"
                        + "      ...opts\n"
                        + "    });\n"
                        + "    Object.setPrototypeOf(this, Err.prototype);\n"
                        + "  }\n"
                        + "}\n");
    }

    @Test
    public void generatesRetryableTraitWithThrottling() {
        testErrorStructureCodegen("error-test-retryable-throttling.smithy",
                "export class Err extends __BaseException {\n"
                        + "  readonly name: \"Err\" = \"Err\";\n"
                        + "  readonly $fault: \"client\" = \"client\";\n"
                        + "  $retryable = {\n"
                        + "    throttling: true,\n"
                        + "  };\n"
                        + "  /**\n"
                        + "   * @internal\n"
                        + "   */\n"
                        + "  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {\n"
                        + "    super({\n"
                        + "      name: \"Err\",\n"
                        + "      $fault: \"client\",\n"
                        + "      ...opts\n"
                        + "    });\n"
                        + "    Object.setPrototypeOf(this, Err.prototype);\n"
                        + "  }\n"
                        + "}\n");
    }

    @Test
    public void filtersSensitiveSimpleShape() {
        testStructureCodegen("test-sensitive-simple-shape.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.password && { password:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})\n");
    }

    @Test
    public void skipsFilterForInsensitiveSimpleShape() {
        testStructureCodegenExcludes("test-insensitive-simple-shape.smithy",
                "GetFooInputFilterSensitiveLog");
    }

    @Test
    public void callsFilterForStructureWithSensitiveData() {
        testStructureCodegen("test-structure-with-sensitive-data.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    UserFilterSensitiveLog(obj.foo)\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void callsFilterInStructureWithSensitiveData() {
        testStructureCodegen("test-structure-with-sensitive-data.smithy",
                "export const UserFilterSensitiveLog = (obj: User): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.password && { password:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void filtersSensitiveStructure() {
        testStructureCodegen("test-sensitive-structure.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void skipsFilterForStructureWithoutSensitiveData() {
        testStructureCodegenExcludes("test-structure-without-sensitive-data.smithy",
                "GetFooInputFilterSensitiveLog");
    }

    @Test
    public void callsFilterForUnionWithSensitiveData() {
        testStructureCodegen("test-union-with-sensitive-data.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    TestUnionFilterSensitiveLog(obj.foo)\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void callsFilterInUnionWithSensitiveData() {
        testStructureCodegen("test-union-with-sensitive-data.smithy",
                "export const TestUnionFilterSensitiveLog = (obj: TestUnion): any => {\n"
                        + "  if (obj.bar !== undefined) return {bar:\n"
                        + "    obj.bar\n"
                        + "  };\n"
                        + "  if (obj.sensitiveBar !== undefined) return {sensitiveBar:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  };\n"
                        + "  if (obj.$unknown !== undefined) return {[obj.$unknown[0]]: 'UNKNOWN'};\n"
                        + "}");
    }

    @Test
    public void callsFilterForUnionWithoutSensitiveData() {
        testStructureCodegenExcludes("test-union-without-sensitive-data.smithy",
                "GetFooInputFilterSensitiveLog");
    }

    @Test
    public void skipsFilterInUnionWithoutSensitiveData() {
        testStructureCodegenExcludes("test-union-without-sensitive-data.smithy",
                "TestUnionFilterSensitiveLog");
    }

    @Test
    public void filtersStreamingUnion() {
        testStructureCodegen("test-streaming-union.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    'STREAMING_CONTENT'\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void filtersSensitiveUnion() {
        testStructureCodegen("test-sensitive-union.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void callsFilterForListWithStructureWithSensitiveData() {
        testStructureCodegen("test-list-with-structure-with-sensitive-data.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    obj.foo.map(\n"
                        + "      item =>\n"
                        + "      UserFilterSensitiveLog(item)\n"
                        + "    )\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void callsFilterInListWithStructureWithSensitiveData() {
        testStructureCodegen("test-list-with-structure-with-sensitive-data.smithy",
                "export const UserFilterSensitiveLog = (obj: User): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.password && { password:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void callsFilterForListWithUnionWithSensitiveData() {
        testStructureCodegen("test-list-with-union-with-sensitive-data.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    obj.foo.map(\n"
                        + "      item =>\n"
                        + "      TestUnionFilterSensitiveLog(item)\n"
                        + "    )\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void callsFilterInListWithUnionWithSensitiveData() {
        testStructureCodegen("test-list-with-union-with-sensitive-data.smithy",
                "export const TestUnionFilterSensitiveLog = (obj: TestUnion): any => {\n"
                        + "  if (obj.bar !== undefined) return {bar:\n"
                        + "    obj.bar\n"
                        + "  };\n"
                        + "  if (obj.sensitiveBar !== undefined) return {sensitiveBar:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  };\n"
                        + "  if (obj.$unknown !== undefined) return {[obj.$unknown[0]]: 'UNKNOWN'};\n"
                        + "}\n");
    }

    @Test
    public void callsFilterForListWithSensitiveMember() {
        testStructureCodegen("test-list-with-sensitive-member.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void filtersSensitiveList() {
        testStructureCodegen("test-sensitive-list.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void skipsFilterForInsensitiveList() {
        testStructureCodegenExcludes("test-insensitive-list.smithy",
                "GetFooInputFilterSensitiveLog");
    }

    @Test
    public void callsFilterForMapWithStructureWithSensitiveData() {
        testStructureCodegen("test-map-with-structure-with-sensitive-data.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    Object.entries(obj.foo).reduce((acc: any, [key, value]: [string, User]) => (\n"
                        + "      acc[key] =\n"
                        + "        UserFilterSensitiveLog(value)\n"
                        + "        ,\n"
                        + "      acc\n"
                        + "    ), {})\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void callsFilterInMapWithStructureWithSensitiveData() {
        testStructureCodegen("test-map-with-structure-with-sensitive-data.smithy",
                "export const UserFilterSensitiveLog = (obj: User): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.password && { password:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void callsFilterForMapWithUnionWithSensitiveData() {
        testStructureCodegen("test-map-with-union-with-sensitive-data.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    Object.entries(obj.foo).reduce((acc: any, [key, value]: [string, TestUnion]) => (\n"
                        + "      acc[key] =\n"
                        + "        TestUnionFilterSensitiveLog(value)\n"
                        + "        ,\n"
                        + "      acc\n"
                        + "    ), {})\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void callsFilterInMapWithUnionWithSensitiveData() {
        testStructureCodegen("test-map-with-union-with-sensitive-data.smithy",
                "export const TestUnionFilterSensitiveLog = (obj: TestUnion): any => {\n"
                        + "  if (obj.bar !== undefined) return {bar:\n"
                        + "    obj.bar\n"
                        + "  };\n"
                        + "  if (obj.sensitiveBar !== undefined) return {sensitiveBar:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  };\n"
                        + "  if (obj.$unknown !== undefined) return {[obj.$unknown[0]]: 'UNKNOWN'};\n"
                        + "}\n");
    }

    @Test
    public void callsFilterForMapWithSensitiveMember() {
        testStructureCodegen("test-map-with-sensitive-member.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void filtersSensitiveMap() {
        testStructureCodegen("test-sensitive-map.smithy",
                "export const GetFooInputFilterSensitiveLog = (obj: GetFooInput): any => ({\n"
                        + "  ...obj,\n"
                        + "  ...(obj.foo && { foo:\n"
                        + "    SENSITIVE_STRING\n"
                        + "  }),\n"
                        + "})");
    }

    @Test
    public void skipsFilterForInsensitiveMap() {
        testStructureCodegenExcludes("test-insensitive-map.smithy",
                "GetFooInputFilterSensitiveLog");
    }

    @Test
    public void skipsFilterOnEncounteringRecursiveShapes() {
        testStructureCodegenExcludes("test-recursive-shapes.smithy",
                "GetFooInputFilterSensitiveLog");
    }

    @Test
    public void properlyGeneratesRequiredMessageMemberNotBackwardCompatible() {
        testStructureCodegenBase("test-required-member.smithy",
                "export interface GetFooOutput {\n"
                        + "  someRequiredMember: string;\n"
                        + "}\n",
                RequiredMemberMode.STRICT, true);
    }

    private String testStructureCodegen(String file, String includedString) {
        return testStructureCodegenBase(file, includedString, RequiredMemberMode.NULLABLE, true);
    }

    private String testStructureCodegenExcludes(String file, String excludedString) {
        return testStructureCodegenBase(file, excludedString, RequiredMemberMode.NULLABLE, false);
    }

    private String testStructureCodegenBase(
            String file,
            String testString,
            RequiredMemberMode requiredMemberMode,
            boolean assertContains) {
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
                        .withMember("requiredMemberMode", Node.from(requiredMemberMode.getMode()))
                        .build())
                .build();

        new TypeScriptClientCodegenPlugin().execute(context);
        String contents = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "//models/models_0.ts").get();

        if (assertContains) {
            assertThat(contents, containsString(testString));
        } else {
            assertThat(contents, not(containsString(testString)));
        }

        return contents;
    }

    private void testErrorStructureCodegen(String file, String expectedType) {
        String contents = testStructureCodegen(file, expectedType);

        assertThat(contents, containsString("as __BaseException"));
    }

    @Test
    public void generatesNonErrorStructures() {
        StructureShape struct = createNonErrorStructure();
        ModelAssembler assembler = Model.assembler()
                .addShape(struct)
                .addImport(getClass().getResource("simple-service.smithy"));
        struct.getAllMembers().values().forEach(assembler::addShape);
        Model model = assembler.assemble().unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());

        TypeScriptWriter writer = new TypeScriptWriter("./foo");
        new StructureGenerator(model, new SymbolVisitor(model, settings), writer, struct).run();
        String output = writer.toString();

        assertThat(output, containsString("export interface Bar {"));
        assertThat(output, containsString("foo?: string;"));
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
        ModelAssembler assembler = Model.assembler()
                .addShape(struct)
                .addImport(getClass().getResource("simple-service.smithy"));
        struct.getAllMembers().values().forEach(assembler::addShape);
        OperationShape operation = OperationShape.builder().id("com.foo#Operation").output(struct).build();
        assembler.addShape(operation);
        Model model = assembler.assemble().unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());

        TypeScriptWriter writer = new TypeScriptWriter("./foo");
        new StructureGenerator(model, new SymbolVisitor(model, settings), writer, struct).run();
        String output = writer.toString();

        assertThat(output, containsString("export interface Bar {"));
    }
}
