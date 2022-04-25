package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;

public class TypeScriptWriterTest {
    private static class ExampleGenerator {
        final TypeScriptWriter writer = new TypeScriptWriter("", true);
        public String doWrite() {
            writer.write("");
            return writer.toString();
        }
    }

    @Test
    public void writesDocStrings() {
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeDocs("These are the docs.\nMore.");
        String result = writer.toString();

        assertThat(result, equalTo("/**\n * These are the docs.\n * More.\n */\n"));
    }

    @Test
    public void doesNotAddNewlineBetweenManagedAndExplicitImports() {
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.write("import { Foo } from \"baz\";");
        writer.addImport("Baz", "Baz", "hello");
        String result = writer.toString();

        assertThat(result, equalTo("import { Baz } from \"hello\";\nimport { Foo } from \"baz\";\n"));
    }

    @Test
    public void escapesDollarInDocStrings() {
        String docs = "This is $ valid documentation.";

        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeDocs(docs);
        String result = writer.toString();

        assertThat(result, equalTo("/**\n * " + docs + "\n */\n"));
    }

    @Test
    public void escapesMultiLineCloseInDocStrings() {
        String docs = "This is */ valid documentation.";

        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeDocs(docs);
        String result = writer.toString();

        assertThat(result, equalTo("/**\n * This is *\\/ valid documentation.\n */\n"));
    }

    @Test
    public void includesAttribution() {
        TypeScriptWriter writer = new TypeScriptWriter("", true);
        writer.write("");
        String result = writer.toString();

        assertThat(result, containsString("// smithy-codegen: TypeScriptWriterTest"));
    }

    @Test
    public void includesAttributionCallerClass() {
        ExampleGenerator caller = new ExampleGenerator();
        String result = caller.doWrite();

        assertThat(result, containsString("// smithy-codegen: TypeScriptWriterTest$ExampleGenerator"));
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
