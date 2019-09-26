package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;

public class SymbolProviderTest {
    @Test
    public void createsSymbols() {
        Shape shape = StructureShape.builder().id("com.foo.baz#Hello").build();
        Model model = Model.assembler().addShape(shape).assemble().unwrap();
        SymbolProvider provider = TypeScriptCodegenPlugin.createSymbolProvider(model);
        Symbol symbol = provider.toSymbol(shape);

        assertThat(symbol.getName(), equalTo("Hello"));
        assertThat(symbol.getNamespace(), equalTo("com/foo/baz/index"));
        assertThat(symbol.getNamespaceDelimiter(), equalTo("/"));
        assertThat(symbol.getDefinitionFile(), equalTo("types/com/foo/baz/index.ts"));
    }

    @Test
    public void createsSymbolsIntoTargetNamespace() {
        Shape shape1 = StructureShape.builder().id("com.foo#Hello").build();
        Shape shape2 = StructureShape.builder().id("com.foo.baz#Hello").build();
        Model model = Model.assembler().addShapes(shape1, shape2).assemble().unwrap();
        SymbolProvider provider = TypeScriptCodegenPlugin.createSymbolProvider(model, "com.foo", "EC2");
        Symbol symbol1 = provider.toSymbol(shape1);
        Symbol symbol2 = provider.toSymbol(shape2);

        assertThat(symbol1.getName(), equalTo("Hello"));
        assertThat(symbol1.getNamespace(), equalTo("ec2/index"));
        assertThat(symbol1.getNamespaceDelimiter(), equalTo("/"));
        assertThat(symbol1.getDefinitionFile(), equalTo("types/ec2/index.ts"));

        assertThat(symbol2.getName(), equalTo("Hello"));
        assertThat(symbol2.getNamespace(), equalTo("ec2/baz/index"));
        assertThat(symbol2.getNamespaceDelimiter(), equalTo("/"));
        assertThat(symbol2.getDefinitionFile(), equalTo("types/ec2/baz/index.ts"));
    }

    @Test
    public void handlesComplexModuleNameCasing() {
        Shape shape1 = StructureShape.builder().id("com.foo#Hello").build();
        Model model = Model.assembler().addShape(shape1).assemble().unwrap();
        SymbolProvider provider = TypeScriptCodegenPlugin.createSymbolProvider(model, "com.foo", "CloudWatch Events");
        Symbol symbol1 = provider.toSymbol(shape1);

        assertThat(symbol1.getName(), equalTo("Hello"));
        assertThat(symbol1.getNamespace(), equalTo("cloudwatchEvents/index"));
        assertThat(symbol1.getNamespaceDelimiter(), equalTo("/"));
        assertThat(symbol1.getDefinitionFile(), equalTo("types/cloudwatchEvents/index.ts"));
    }

    @Test
    public void escapesReservedWords() {
        Shape shape = StructureShape.builder().id("com.foo.baz#Pick").build();
        Model model = Model.assembler().addShape(shape).assemble().unwrap();
        SymbolProvider provider = TypeScriptCodegenPlugin.createSymbolProvider(model);
        Symbol symbol = provider.toSymbol(shape);

        assertThat(symbol.getName(), equalTo("_Pick"));
    }

    @Test
    public void doesNotEscapeBuiltins() {
        MemberShape member = MemberShape.builder().id("foo.bar#Object$a").target("smithy.api#String").build();
        StructureShape struct = StructureShape.builder()
                .id("foo.bar#Object")
                .addMember(member)
                .build();
        Model model = Model.assembler()
                .addShapes(struct, member)
                .assemble()
                .unwrap();

        SymbolProvider provider = TypeScriptCodegenPlugin.createSymbolProvider(model);
        Symbol structSymbol = provider.toSymbol(struct);
        Symbol memberSymbol = provider.toSymbol(member);

        // Normal structure with escaping.
        assertThat(structSymbol.getName(), equalTo("_Object"));
        assertThat(structSymbol.getNamespace(), equalTo("foo/bar/index"));

        // Reference to built-in type with no escaping.
        assertThat(memberSymbol.getName(), equalTo("string"));
        assertThat(memberSymbol.getNamespace(), equalTo(""));
    }

    @Test
    public void escapesRecursiveSymbols() {
        StructureShape record = StructureShape.builder().id("foo.bar#Record").build();
        MemberShape listMember = MemberShape.builder().id("foo.bar#Records$member").target(record).build();
        ListShape list = ListShape.builder()
                .id("foo.bar#Records")
                .member(listMember)
                .build();
        Model model = Model.assembler()
                .addShapes(list, listMember, record)
                .assemble()
                .unwrap();

        SymbolProvider provider = TypeScriptCodegenPlugin.createSymbolProvider(model);
        Symbol listSymbol = provider.toSymbol(list);

        assertThat(listSymbol.getName(), equalTo("Array<_Record>"));
    }
}
