package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.CodegenException;

public class ImportDeclarationsTest {
    @Test
    public void addsSingleNonAliasedImport() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar");
        declarations.addImport("Big", "", "big.js");
        String result = declarations.toString();

        assertThat(result, containsString("import { Big } from \"big.js\";"));
    }

    @Test
    public void addsSingleAliasedImport() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar");
        declarations.addImport("Big", "$Big", "big.js");
        String result = declarations.toString();

        assertThat(result, containsString("import { Big as $Big } from \"big.js\";"));
    }

    @Test
    public void addsMultipleImportsOfSameSymbol() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar");
        declarations.addImport("Big", "Big", "big.js");
        declarations.addImport("Big", "$Big", "big.js");
        String result = declarations.toString();

        assertThat(result, containsString("import {\n  Big as $Big,\n  Big,\n} from \"big.js\";"));
    }

    @Test
    public void relativizesImports() {
        ImportDeclarations declarations = new ImportDeclarations("./foo/bar/index");
        declarations.addImport("Baz", "", "./foo/bar/bam");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"./bam\";"));
    }

    @Test
    public void relativizesImportsWithTrailingFilenameOnIndex() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar/index");
        declarations.addImport("Baz", "", "./shared/shapeTypes");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"../../shared/shapeTypes\";"));
    }

    @Test
    public void relativizesImportsWithTrailingFilenameNotIndex() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar/hello/index");
        declarations.addImport("Baz", "", "./shared/shapeTypes");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"../../../shared/shapeTypes\";"));
    }

    @Test
    public void automaticallyCorrectsBasePath() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar/index");
        declarations.addImport("Baz", "", "./foo/bar/bam/qux");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"./bam/qux\";"));
    }

    @Test
    public void doesNotRelativizeAbsolutePaths() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addImport("Baz", "", "@types/foo");
        declarations.addImport("Hello", "", "/abc/def");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"@types/foo\";"));
        assertThat(result, containsString("import { Hello } from \"/abc/def\";"));
    }

    @Test
    public void canImportFilesUpLevels() {
        ImportDeclarations declarations = new ImportDeclarations("./foo/bar/index");
        declarations.addImport("SharedThing", "", "./shared/types");
        String result = declarations.toString();

        assertThat(result, containsString("import { SharedThing } from \"../../shared/types\";"));
    }

    @Test
    public void throwsOnStarImport() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addImport("*", "_baz", "@types/foo");
        Assertions.assertThrows(CodegenException.class, () -> declarations.toString());
    }

    @Test
    public void canImportDefaultImport() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addDefaultImport("foo", "@types/foo");
        String result = declarations.toString();

        assertThat(result, containsString("import foo from \"@types/foo\";"));
    }

    @Test
    public void canImportDefaultImportWithNamedImport() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addDefaultImport("foo", "@types/foo");
        declarations.addImport("Bar", "Bar", "@types/foo");
        String result = declarations.toString();

        assertThat(result, containsString("import foo from \"@types/foo\";"));
        assertThat(result, containsString("import { Bar } from \"@types/foo\";"));
    }

    @Test
    public void canImportNestedFromRoot() {
        ImportDeclarations declarations = new ImportDeclarations("");
        declarations.addImport("Foo", "", "./models/foo");
        String result = declarations.toString();

        assertThat(result, containsString("import { Foo } from \"./models/foo\";"));
    }

    @Test
    public void canImportNestedFromClient() {
        ImportDeclarations declarations = new ImportDeclarations("./FooClient");
        declarations.addImport("Foo", "", "./models/hello/index");
        String result = declarations.toString();

        assertThat(result, containsString("import { Foo } from \"./models/hello/index\";"));
    }
}
