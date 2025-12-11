/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
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
        writer.addImport("Baz", "Baz", "./hello");
        writer.addImport("Bar", "__Bar", TypeScriptDependency.SMITHY_TYPES);
        writer.addRelativeImport("Qux", "__Qux", Paths.get("./qux"));
        String result = writer.toString();

        assertEquals("""
                %simport { Bar as __Bar } from "@smithy/types";

                import { Baz } from "./hello";
                import { Qux as __Qux } from "./qux";
                import { Foo } from "baz";
                """.formatted(CODEGEN_INDICATOR), result);
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

    @Test
    public void addImportSubmodule() {
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
        writer.addImportSubmodule("symbol", "__symbol", () -> "@smithy/core", "/submodule");
        String result = writer.toString();

        assertEquals("""
                %simport { symbol as __symbol } from "@smithy/core/submodule";
                """.formatted(CODEGEN_INDICATOR).trim(), result.trim());
    }
}
