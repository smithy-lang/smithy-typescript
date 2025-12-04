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
                """
                export class Err extends __BaseException {
                  readonly name = "Err" as const;
                  readonly $fault = "client" as const;
                  /**
                   * @internal
                   */
                  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {
                    super({
                      name: "Err",
                      $fault: "client",
                      ...opts,
                    });
                    Object.setPrototypeOf(this, Err.prototype);
                  }
                }
                """);
    }

    @Test
    public void properlyGeneratesOptionalMessageMemberOfException() {
        testErrorStructureCodegen("error-test-optional-message.smithy",
                """
                export class Err extends __BaseException {
                  readonly name = "Err" as const;
                  readonly $fault = "client" as const;
                  /**
                   * @internal
                   */
                  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {
                    super({
                      name: "Err",
                      $fault: "client",
                      ...opts,
                    });
                    Object.setPrototypeOf(this, Err.prototype);
                  }
                }
                """);
    }

    @Test
    public void properlyGeneratesRequiredMessageMemberOfException() {
        testErrorStructureCodegen("error-test-required-message.smithy",
                """
                export class Err extends __BaseException {
                  readonly name = "Err" as const;
                  readonly $fault = "client" as const;
                  /**
                   * @internal
                   */
                  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {
                    super({
                      name: "Err",
                      $fault: "client",
                      ...opts,
                    });
                    Object.setPrototypeOf(this, Err.prototype);
                  }
                }
                """);
    }

    @Test
    public void properlyGeneratesOptionalNonMessageMemberOfException() {
        testErrorStructureCodegen("error-test-optional-member-no-message.smithy",
                """
                export class Err extends __BaseException {
                  readonly name = "Err" as const;
                  readonly $fault = "client" as const;
                  foo?: string | undefined;
                  /**
                   * @internal
                   */
                  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {
                    super({
                      name: "Err",
                      $fault: "client",
                      ...opts,
                    });
                    Object.setPrototypeOf(this, Err.prototype);
                    this.foo = opts.foo;
                  }
                }
                """);
    }

    @Test
    public void properlyGeneratesRequiredNonMessageMemberOfException() {
        testErrorStructureCodegen("error-test-required-member-no-message.smithy",
                """
                export class Err extends __BaseException {
                  readonly name = "Err" as const;
                  readonly $fault = "client" as const;
                  foo: string | undefined;
                  /**
                   * @internal
                   */
                  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {
                    super({
                      name: "Err",
                      $fault: "client",
                      ...opts,
                    });
                    Object.setPrototypeOf(this, Err.prototype);
                    this.foo = opts.foo;
                  }
                }
                """);
    }

    @Test
    public void generatesEmptyRetryableTrait() {
        testErrorStructureCodegen("error-test-retryable.smithy",
                """
                export class Err extends __BaseException {
                  readonly name = "Err" as const;
                  readonly $fault = "client" as const;
                  $retryable = {};
                  /**
                   * @internal
                   */
                  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {
                    super({
                      name: "Err",
                      $fault: "client",
                      ...opts,
                    });
                    Object.setPrototypeOf(this, Err.prototype);
                  }
                }
                """);
    }

    @Test
    public void generatesRetryableTraitWithThrottling() {
        testErrorStructureCodegen("error-test-retryable-throttling.smithy",
                """
                export class Err extends __BaseException {
                  readonly name = "Err" as const;
                  readonly $fault = "client" as const;
                  $retryable = {
                    throttling: true,
                  };
                  /**
                   * @internal
                   */
                  constructor(opts: __ExceptionOptionType<Err, __BaseException>) {
                    super({
                      name: "Err",
                      $fault: "client",
                      ...opts,
                    });
                    Object.setPrototypeOf(this, Err.prototype);
                  }
                }
                """);
    }

    @Test
    public void properlyGeneratesRequiredMessageMemberNotBackwardCompatible() {
        testStructureCodegenBase("test-required-member.smithy",
                """
                export interface GetFooOutput {
                  someRequiredMember: string;
                }
                """,
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

        new TypeScriptCodegenPlugin().execute(context);
        String contents = "";
        contents += manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "//models/models_0.ts").orElse("");
        contents += manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "//models/enums.ts").orElse("");
        contents += manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "//models/errors.ts").orElse("");

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
        assertThat(output, containsString("foo?: string | undefined;"));
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