package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.stringContainsInOrder;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.IntEnumShape;

public class IntEnumGeneratorTest {
    @Test
    public void generatesIntEnums() {
        IntEnumShape shape = IntEnumShape.builder()
                .id("com.foo#Foo")
                .addMember("BAR", 5)
                .addMember("BAZ", 2)
                .build();
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        Model model = Model.assembler()
                .addShape(shape)
                .addImport(getClass().getResource("simple-service.smithy"))
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
        Symbol symbol = new SymbolVisitor(model, settings).toSymbol(shape);
        new IntEnumGenerator(shape, symbol, writer).run();

        assertThat(writer.toString(), containsString("export enum Foo {"));
        assertThat(writer.toString(), stringContainsInOrder("BAZ = 2,", "BAR = 5,"));
    }
}
