package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;

public class SymbolProviderTest {
    @Test
    public void createsSymbols() {
        Shape shape = StructureShape.builder().id("com.foo.baz#Hello").build();
        Model model = Model.assembler().addShape(shape).assemble().unwrap();
        SymbolProvider provider = TypeScriptCodegenPlugin.createSymbolProvider(model);
        Symbol symbol = provider.toSymbol(shape);

        assertThat(symbol.getName(), equalTo("Hello"));
        assertThat(symbol.getNamespace(), equalTo("com/foo/baz"));
        assertThat(symbol.getNamespaceDelimiter(), equalTo("/"));
        assertThat(symbol.getDefinitionFile(), equalTo("types/com/foo/baz.ts"));
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
    public void doesNotEscapeBuiltinSymbols() {
        Shape shape = StringShape.builder().id("com.foo.baz#String").build();
        Model model = Model.assembler().addShape(shape).assemble().unwrap();
        SymbolProvider provider = TypeScriptCodegenPlugin.createSymbolProvider(model);
        Symbol symbol = provider.toSymbol(shape);

        assertThat(symbol.getName(), equalTo("string"));
        assertThat(symbol.getNamespace(), equalTo(""));
    }
}
