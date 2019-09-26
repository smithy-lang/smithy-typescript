package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import org.junit.jupiter.api.Test;

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
        ImportDeclarations declarations = new ImportDeclarations("./foo/bar");
        declarations.addImport("Baz", "", "./foo/bar/bam");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"./bam\";"));
    }

    @Test
    public void relativizesImportsWithTrailingFilename() {
        ImportDeclarations declarations = new ImportDeclarations("foo/bar/index");
        declarations.addImport("Baz", "", "./shared/shapeTypes");
        String result = declarations.toString();

        assertThat(result, containsString("import { Baz } from \"../../../shared/shapeTypes\";"));
    }

    @Test
    public void automaticallyCorrectsBasePath() {
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
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
        ImportDeclarations declarations = new ImportDeclarations("/foo/bar");
        declarations.addImport("SharedThing", "", "./shared/types");
        String result = declarations.toString();

        assertThat(result, containsString("import { SharedThing } from \"../../shared/types\";"));
    }
}
