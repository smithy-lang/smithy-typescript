package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.stringContainsInOrder;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.traits.EnumDefinition;
import software.amazon.smithy.model.traits.EnumTrait;

public class EnumGeneratorTest {
  @Test
  public void generatesNamedEnums() {
    EnumTrait trait =
        EnumTrait.builder()
            .addEnum(EnumDefinition.builder().value("FOO").name("FOO").build())
            .addEnum(EnumDefinition.builder().value("BAR").name("BAR").build())
            .build();
    StringShape shape = StringShape.builder().id("com.foo#Baz").addTrait(trait).build();
    TypeScriptWriter writer = new TypeScriptWriter("foo");
    Model model =
        Model.assembler()
            .addShape(shape)
            .addImport(getClass().getResource("simple-service.smithy"))
            .assemble()
            .unwrap();
    TypeScriptSettings settings =
        TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
    Symbol symbol = new SymbolVisitor(model, settings).toSymbol(shape);
    new EnumGenerator(shape, symbol, writer).run();

    assertThat(writer.toString(), containsString("export const Baz = {"));
    assertThat(writer.toString(), stringContainsInOrder("BAR: \"BAR\",", "FOO: \"FOO\""));
    assertThat(
        writer.toString(), containsString("export type Baz = (typeof Baz)[keyof typeof Baz];"));
  }

  @Test
  public void generatesUnnamedEnums() {
    EnumTrait trait =
        EnumTrait.builder()
            .addEnum(EnumDefinition.builder().value("FOO").build())
            .addEnum(EnumDefinition.builder().value("BAR").build())
            .build();
    StringShape shape = StringShape.builder().id("com.foo#Baz").addTrait(trait).build();
    TypeScriptWriter writer = new TypeScriptWriter("foo");
    Model model =
        Model.assembler()
            .addShape(shape)
            .addImport(getClass().getResource("simple-service.smithy"))
            .assemble()
            .unwrap();
    TypeScriptSettings settings =
        TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
    Symbol symbol = new SymbolVisitor(model, settings).toSymbol(shape);
    new EnumGenerator(shape, symbol, writer).run();

    assertThat(writer.toString(), containsString("export type Baz = \"BAR\" | \"FOO\""));
  }
}
