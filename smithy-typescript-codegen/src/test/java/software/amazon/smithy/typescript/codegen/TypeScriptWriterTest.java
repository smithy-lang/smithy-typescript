package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static software.amazon.smithy.typescript.codegen.TypeScriptWriter.CODEGEN_INDICATOR;

import java.nio.file.Paths;
import org.junit.jupiter.api.Test;

public class TypeScriptWriterTest {
    @Test
    public void writesDocStrings() {
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeDocs("These are the docs.\nMore.");
        String result = writer.toString();

        assertThat(result, equalTo(CODEGEN_INDICATOR + "/**\n * These are the docs.\n * More.\n */\n"));
    }

    @Test
    public void doesNotAddNewlineBetweenManagedAndExplicitImports() {
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.write("import { Foo } from \"baz\";");
        writer.addImport("Baz", "Baz", "hello");
        writer.addImport("Bar", "__Bar", TypeScriptDependency.SMITHY_TYPES);
        writer.addRelativeImport("Qux", "__Qux", Paths.get("./qux"));
        String result = writer.toString();

        assertThat(result, equalTo(CODEGEN_INDICATOR + "import { Qux as __Qux } from \"./qux\";\n"
                + "import { Bar as __Bar } from \"@smithy/types\";\n"
                + "import { Baz } from \"hello\";\n"
                + "import { Foo } from \"baz\";\n"));
    }

    @Test
    public void escapesDollarInDocStrings() {
        String docs = "This is $ valid documentation.";

        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeDocs(docs);
        String result = writer.toString();

        assertThat(result, equalTo(CODEGEN_INDICATOR + "/**\n * " + docs + "\n */\n"));
    }

    @Test
    public void escapesMultiLineCloseInDocStrings() {
        String docs = "This is */ valid documentation.";

        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeDocs(docs);
        String result = writer.toString();

        assertThat(result, equalTo(CODEGEN_INDICATOR + "/**\n * This is *\\/ valid documentation.\n */\n"));
    }

    @Test
    public void addsFormatterForSymbols() {
        // TODO
    }

    @Test
    public void addsFormatterForSymbolReferences() {
        // TODO
    }
}
