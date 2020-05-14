package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.traits.EnumDefinition;
import software.amazon.smithy.model.traits.EnumTrait;

public class EnumGeneratorTest {
    @Test
    public void generatesNamedEnums() {
        EnumTrait trait = EnumTrait.builder()
                .addEnum(EnumDefinition.builder().value("FOO").name("FOO").build())
                .addEnum(EnumDefinition.builder().value("BAR").name("BAR").build())
                .build();
        StringShape shape = StringShape.builder().id("com.foo#Baz").addTrait(trait).build();
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        Symbol symbol = TypeScriptCodegenPlugin.createSymbolProvider(Model.builder().build()).toSymbol(shape);
        new EnumGenerator(shape, symbol, writer).run();

        assertThat(writer.toString(), containsString("export enum Baz {"));
        assertThat(writer.toString(), containsString("FOO = \"FOO\""));
        assertThat(writer.toString(), containsString("BAR = \"BAR\","));
    }

    @Test
    public void generatesUnnamedEnums() {
        EnumTrait trait = EnumTrait.builder()
                .addEnum(EnumDefinition.builder().value("FOO").build())
                .addEnum(EnumDefinition.builder().value("BAR").build())
                .build();
        StringShape shape = StringShape.builder().id("com.foo#Baz").addTrait(trait).build();
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        Symbol symbol = TypeScriptCodegenPlugin.createSymbolProvider(Model.builder().build()).toSymbol(shape);
        new EnumGenerator(shape, symbol, writer).run();

        assertThat(writer.toString(), containsString("export type Baz = \"BAR\" | \"FOO\""));
    }
}
