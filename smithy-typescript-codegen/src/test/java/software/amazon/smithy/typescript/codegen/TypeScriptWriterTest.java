/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static software.amazon.smithy.typescript.codegen.TypeScriptWriter.CODEGEN_INDICATOR;

import java.nio.file.Paths;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.traits.DeprecatedTrait;
import software.amazon.smithy.model.traits.DocumentationTrait;

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

        assertEquals(
            """
            %simport { Bar as __Bar } from "@smithy/types";

            import { Baz } from "./hello";
            import { Qux as __Qux } from "./qux";
            import { Foo } from "baz";
            """.formatted(CODEGEN_INDICATOR),
            result
        );
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
    public void convertsHtmlInDocStringsToMarkdown() {
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeDocs("<p>A name for the <code>log</code> group.</p>");
        String result = writer.toString();

        assertThat(
            result,
            equalTo(CODEGEN_INDICATOR + "/**\n * A name for the `log` group.\n */\n")
        );
    }

    @Test
    public void convertsHtmlReachingWriteDocsFromAnyCaller() {
        // Operation @throws sections, enum value docs and package docs all build their
        // string and hand it to writeDocs, so converting there covers every caller.
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeDocs(
            "@throws {@link InvalidParameterException} (client fault)\n"
                + " <p>The parameter is invalid.</p>\n"
        );
        String result = writer.toString();

        assertThat(result, containsString("@throws {@link InvalidParameterException} (client fault)"));
        assertThat(result, containsString("The parameter is invalid."));
        assertThat(result, not(containsString("<p>")));
    }

    @Test
    public void leavesGeneratedExamplesUntouched() {
        // CommandGenerator appends a usage example as a fenced block. Its indentation is
        // significant, so the converter has to leave it alone.
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeDocs(
            """
            <p>Registers a task.</p>
            @example
            ```javascript
            const input = {
              family: "STRING_VALUE",
            };
            ```"""
        );
        String result = writer.toString();

        assertThat(result, containsString(" * const input = {\n *   family: \"STRING_VALUE\",\n * };"));
        assertThat(result, containsString(" * Registers a task."));
    }

    @Test
    public void convertsHtmlInShapeDocs() {
        StringShape shape = StringShape.builder()
            .id(ShapeId.from("com.example#MyString"))
            .addTrait(
                new DocumentationTrait(
                    "<p>See <a href=\"https://example.com/g\">the guide</a>.</p>"
                )
            )
            .build();

        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeShapeDocs(shape);
        String result = writer.toString();

        assertThat(result, containsString("See [the guide](https://example.com/g)."));
        assertThat(result, containsString("@public"));
        assertThat(result, not(containsString("<a href")));
    }

    @Test
    public void addImportSubmodule() {
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
        writer.addImportSubmodule("symbol", "__symbol", () -> "@smithy/core", "/submodule");
        String result = writer.toString();

        assertEquals(
            """
            %simport { symbol as __symbol } from "@smithy/core/submodule";
            """.formatted(CODEGEN_INDICATOR)
                .trim(),
            result.trim()
        );
    }

    @Test
    public void writeShapeDocsIncludesSinceFromDeprecatedTrait() {
        StringShape shape = StringShape.builder()
            .id(ShapeId.from("com.example#MyString"))
            .addTrait(new DocumentationTrait("Some docs."))
            .addTrait(
                DeprecatedTrait.builder()
                    .message("Use MyStringV2 instead")
                    .since("2024-01-01")
                    .build()
            )
            .build();

        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeShapeDocs(shape);
        String result = writer.toString();

        assertThat(result, containsString("@deprecated (since 2024-01-01) Use MyStringV2 instead."));
    }

    @Test
    public void writeShapeDocsOmitsSinceWhenNotSet() {
        StringShape shape = StringShape.builder()
            .id(ShapeId.from("com.example#MyString"))
            .addTrait(new DocumentationTrait("Some docs."))
            .addTrait(
                DeprecatedTrait.builder()
                    .message("Use MyStringV2 instead")
                    .build()
            )
            .build();

        TypeScriptWriter writer = new TypeScriptWriter("foo");
        writer.writeShapeDocs(shape);
        String result = writer.toString();

        assertThat(result, containsString("@deprecated Use MyStringV2 instead."));
        assertThat(result, not(containsString("since")));
    }

    @Test
    public void buildDeprecationAnnotationWithMessageOnly() {
        DeprecatedTrait trait = DeprecatedTrait.builder()
            .message("Use FooV2 instead")
            .build();
        String result = TypeScriptWriter.buildDeprecationAnnotation(trait);
        assertEquals("@deprecated Use FooV2 instead.", result);
    }

    @Test
    public void buildDeprecationAnnotationWithSinceOnly() {
        DeprecatedTrait trait = DeprecatedTrait.builder()
            .since("2024-01-01")
            .build();
        String result = TypeScriptWriter.buildDeprecationAnnotation(trait);
        assertEquals("@deprecated since 2024-01-01.", result);
    }

    @Test
    public void buildDeprecationAnnotationWithMessageAndSince() {
        DeprecatedTrait trait = DeprecatedTrait.builder()
            .message("Use FooV2 instead")
            .since("2024-01-01")
            .build();
        String result = TypeScriptWriter.buildDeprecationAnnotation(trait);
        assertEquals("@deprecated (since 2024-01-01) Use FooV2 instead.", result);
    }

    @Test
    public void buildDeprecationAnnotationWithNoFields() {
        DeprecatedTrait trait = DeprecatedTrait.builder().build();
        String result = TypeScriptWriter.buildDeprecationAnnotation(trait);
        assertEquals("@deprecated deprecated.", result);
    }

    @Test
    public void buildIncredulousDeprecationAnnotation() {
        DeprecatedTrait trait = DeprecatedTrait.builder()
            .message("what??")
            .build();
        String result = TypeScriptWriter.buildDeprecationAnnotation(trait);
        assertEquals("@deprecated what??", result);
    }

    @Test
    public void buildDramaticDeprecationAnnotation() {
        DeprecatedTrait trait = DeprecatedTrait.builder()
            .message("Noo!!!")
            .build();
        String result = TypeScriptWriter.buildDeprecationAnnotation(trait);
        assertEquals("@deprecated Noo!!!", result);
    }

    @Test
    public void buildHtmlDeprecationAnnotation() {
        DeprecatedTrait trait = DeprecatedTrait.builder()
            .message("<p>Hello</p>")
            .build();
        String result = TypeScriptWriter.buildDeprecationAnnotation(trait);
        assertEquals("@deprecated <p>Hello</p>", result);
    }
}
