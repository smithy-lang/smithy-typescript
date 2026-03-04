/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

public class DocumentationConverterTest {

    @Test
    public void returnsNullForNull() {
        assertNull(DocumentationConverter.htmlToPlainText(null));
    }

    @Test
    public void returnsEmptyForEmpty() {
        assertEquals("", DocumentationConverter.htmlToPlainText(""));
    }

    @Test
    public void passesPlainTextThrough() {
        assertEquals("Hello world.", DocumentationConverter.htmlToPlainText("Hello world."));
    }

    @Test
    public void stripsParagraphTags() {
        String html = "<p>First paragraph.</p><p>Second paragraph.</p>";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("First paragraph.\n\nSecond paragraph.", result);
    }

    @Test
    public void stripsAnchorTagsKeepsText() {
        String html = "See <a href=\"https://example.com\">the docs</a> for details.";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("See the docs for details.", result);
    }

    @Test
    public void convertsCodeTagsToBackticks() {
        String html = "Use the <code>FooClient</code> class.";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("Use the `FooClient` class.", result);
    }

    @Test
    public void convertsUnorderedList() {
        String html = "<p>Options:</p><ul><li>Option A</li><li>Option B</li></ul>";
        String result = DocumentationConverter.htmlToPlainText(html);
        // Should have dash-prefixed items.
        assertTrue(result.startsWith("Options:"), "Should start with 'Options:', got: " + result);
        assertTrue(result.contains("- Option A"), "Should contain dash-prefixed Option A, got: " + result);
        assertTrue(result.contains("- Option B"), "Should contain dash-prefixed Option B, got: " + result);
    }

    @Test
    public void stripsInlineFormattingTags() {
        String html = "This is <b>bold</b> and <i>italic</i> and <strong>strong</strong>.";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("This is bold and italic and strong.", result);
    }

    @Test
    public void decodesHtmlEntities() {
        String html = "A &amp; B &lt; C &gt; D &quot;E&quot; F&#39;s";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("A & B < C > D \"E\" F's", result);
    }

    @Test
    public void decodesNumericEntities() {
        String html = "&#169; 2024";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("\u00A9 2024", result);
    }

    @Test
    public void decodesHexEntities() {
        String html = "&#xA9; 2024";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("\u00A9 2024", result);
    }

    @Test
    public void handlesBrTags() {
        String html = "Line one.<br/>Line two.<br>Line three.";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("Line one.\n\nLine two.\n\nLine three.", result);
    }

    @Test
    public void collapsesExcessiveWhitespace() {
        String html = "<p>First.</p>\n\n\n<p>Second.</p>\n\n\n\n<p>Third.</p>";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("First.\n\nSecond.\n\nThird.", result);
    }

    @Test
    public void handlesNestedHtml() {
        String html = "<p>Use <a href=\"https://example.com\"><code>MyApi</code></a> to call the service.</p>";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("Use `MyApi` to call the service.", result);
    }

    @Test
    public void handlesDefinitionList() {
        String html = "<dl><dt>Term</dt><dd>Definition</dd></dl>";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertTrue(result.contains("Term"), "Should contain the term");
        assertTrue(result.contains("Definition"), "Should contain the definition");
        assertTrue(result.contains("-"), "Should contain a separator");
    }

    @Test
    public void handlesNbsp() {
        String html = "Hello&nbsp;world";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals("Hello world", result);
    }

    @Test
    public void handlesRealWorldEcsExample() {
        // Simplified version of the ECS RegisterTaskDefinition docs from the issue.
        String html = "<p>Registers a new task definition from the supplied <code>family</code> and "
            + "<code>containerDefinitions</code>. Optionally, you can add data volumes to your containers "
            + "with the <code>volumes</code> parameter. For more information about task definition parameters "
            + "and defaults, see <a href=\"https://docs.aws.amazon.com/AmazonECS/latest/developerguide/"
            + "task_defintions.html\">Amazon ECS Task Definitions</a> in the "
            + "<i>Amazon Elastic Container Service Developer Guide</i>.</p>";
        String result = DocumentationConverter.htmlToPlainText(html);
        assertEquals(
            "Registers a new task definition from the supplied `family` and "
                + "`containerDefinitions`. Optionally, you can add data volumes to your containers "
                + "with the `volumes` parameter. For more information about task definition parameters "
                + "and defaults, see Amazon ECS Task Definitions in the "
                + "Amazon Elastic Container Service Developer Guide.",
            result
        );
    }
}
