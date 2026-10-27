/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

import org.junit.jupiter.api.Test;

public class DocumentationConverterTest {

    @Test
    public void passesThroughNullAndEmpty() {
        assertThat(DocumentationConverter.htmlToMarkdown(null), nullValue());
        assertThat(DocumentationConverter.htmlToMarkdown(""), equalTo(""));
    }

    @Test
    public void leavesTextWithoutMarkupUnchanged() {
        String docs = "These are the docs.\nMore.";
        assertThat(DocumentationConverter.htmlToMarkdown(docs), equalTo(docs));
    }

    @Test
    public void unwrapsParagraph() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>A name for the log group.</p>"),
            equalTo("A name for the log group.")
        );
    }

    @Test
    public void separatesParagraphsWithABlankLine() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>One.</p> <p>Two.</p>"),
            equalTo("One.\n\nTwo.")
        );
    }

    @Test
    public void collapsesWhitespaceWithinAParagraph() {
        // Model files wrap and indent documentation. Left alone, the indentation would be
        // read as a Markdown code block.
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>One\n            two\n            three.</p>"),
            equalTo("One two three.")
        );
    }

    @Test
    public void convertsAnchorToMarkdownLink() {
        assertThat(
            DocumentationConverter.htmlToMarkdown(
                "<p>For more information, see <a href=\"https://docs.aws.amazon.com/x.html\">Task "
                    + "Definitions</a> in the guide.</p>"
            ),
            equalTo(
                "For more information, see [Task Definitions](https://docs.aws.amazon.com/x.html) in the guide."
            )
        );
    }

    @Test
    public void usesTheHrefAsTextForAnEmptyAnchor() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<a href=\"https://example.com\"></a>"),
            equalTo("[https://example.com](https://example.com)")
        );
    }

    @Test
    public void keepsAnchorTextWhenThereIsNoHref() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>See <a>the guide</a>.</p>"),
            equalTo("See the guide.")
        );
    }

    @Test
    public void delimitsLinkDestinationsContainingParentheses() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<a href=\"https://example.com/a_(b)\">x</a>"),
            equalTo("[x](<https://example.com/a_(b)>)")
        );
    }

    @Test
    public void convertsCodeToACodeSpan() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>Supplied from <code>family</code>.</p>"),
            equalTo("Supplied from `family`.")
        );
    }

    @Test
    public void lengthensTheDelimiterWhenCodeContainsABacktick() {
        assertThat(DocumentationConverter.htmlToMarkdown("<code>a`b</code>"), equalTo("``a`b``"));
    }

    @Test
    public void convertsEmphasis() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>in the <i>Developer Guide</i>.</p>"),
            equalTo("in the *Developer Guide*.")
        );
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>a <b>bold</b> word</p>"),
            equalTo("a **bold** word")
        );
    }

    @Test
    public void movesWhitespaceOutsideEmphasisDelimiters() {
        // Markdown requires the delimiters to sit against the text they emphasize.
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>a<b> bold </b>word</p>"),
            equalTo("a **bold** word")
        );
    }

    @Test
    public void convertsListItemsThatWrapTheirTextInAParagraph() {
        // Models almost always write items as <li><p>text</p></li>. A conversion that
        // handles the tags in the wrong order leaves the marker alone on its own line.
        assertThat(
            DocumentationConverter.htmlToMarkdown(
                "<ul> <li><p>First item.</p></li> <li><p>Second item.</p></li> </ul>"
            ),
            equalTo("- First item.\n- Second item.")
        );
    }

    @Test
    public void convertsListItemsWithoutAParagraph() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<ul><li>First</li><li>Second</li></ul>"),
            equalTo("- First\n- Second")
        );
    }

    @Test
    public void numbersOrderedListItems() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<ol><li><p>First</p></li><li><p>Second</p></li></ol>"),
            equalTo("1. First\n2. Second")
        );
    }

    @Test
    public void indentsNestedLists() {
        assertThat(
            DocumentationConverter.htmlToMarkdown(
                "<ul><li><p>Outer</p><ul><li><p>Inner</p></li></ul></li></ul>"
            ),
            equalTo("- Outer\n\n  - Inner")
        );
    }

    @Test
    public void alignsContinuationLinesOfAListItem() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<ul><li><p>One.</p><p>Two.</p></li></ul>"),
            equalTo("- One.\n\n  Two.")
        );
    }

    @Test
    public void convertsDefinitionLists() {
        assertThat(
            DocumentationConverter.htmlToMarkdown(
                "<dl><dt>Permissions</dt><dd><p>You must have access.</p></dd></dl>"
            ),
            equalTo("- **Permissions**\n\n  You must have access.")
        );
    }

    @Test
    public void convertsASingleLineCalloutToABlockQuote() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<note><p>Be careful.</p></note>"),
            equalTo("> **Note:** Be careful.")
        );
        assertThat(
            DocumentationConverter.htmlToMarkdown("<important><p>Read this.</p></important>"),
            equalTo("> **Important:** Read this.")
        );
    }

    @Test
    public void quotesEveryLineOfAMultiLineCallout() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<note><p>One.</p><p>Two.</p></note>"),
            equalTo("> **Note:**\n>\n> One.\n>\n> Two.")
        );
    }

    @Test
    public void convertsHeadings() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<h2>Title</h2><p>Body.</p>"),
            equalTo("## Title\n\nBody.")
        );
    }

    @Test
    public void convertsPreformattedTextToAFencedBlock() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>Example:</p><pre>a = 1\nb = 2</pre>"),
            equalTo("Example:\n\n```\na = 1\nb = 2\n```")
        );
    }

    @Test
    public void discardsTagsThatCarryNoFormatting() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>a <span>b</span> <replaceable>c</replaceable></p>"),
            equalTo("a b c")
        );
    }

    @Test
    public void leavesTypeScriptGenericsAlone() {
        // Documentation written by hand reaches this converter too, and a generic must not
        // be mistaken for markup.
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>Returns Array<string> values.</p>"),
            equalTo("Returns Array<string> values.")
        );
    }

    @Test
    public void dropsInlineMarkupInsideCode() {
        // Models italicize the variable parts of an ARN. Markdown has no formatting inside
        // a code span, so the tags are dropped and the text kept.
        assertThat(
            DocumentationConverter.htmlToMarkdown(
                "<p>Of the form <code>arn:aws:acm:<i>region</i>:<i>account</i>:certificate/<i>id</i></code>.</p>"
            ),
            equalTo("Of the form `arn:aws:acm:region:account:certificate/id`.")
        );
    }

    @Test
    public void keepsAnchorTextInsideCode() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<code><a href=\"https://example.com\">value</a></code>"),
            equalTo("`value`")
        );
    }

    @Test
    public void leavesDocumentationPlaceholdersAlone() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>Use <code>arn:aws:s3:::<bucket-name></code> here.</p>"),
            equalTo("Use `arn:aws:s3:::<bucket-name>` here.")
        );
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>Replace <account-id> with your account.</p>"),
            equalTo("Replace <account-id> with your account.")
        );
    }

    @Test
    public void keepsNamedEntitiesOutsideOfCode() {
        // Markdown renderers resolve these, and decoding them would reintroduce the bare
        // characters that need to stay escaped.
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>a &lt;b&gt; &amp; c</p>"),
            equalTo("a &lt;b&gt; &amp; c")
        );
    }

    @Test
    public void decodesNamedEntitiesInsideCode() {
        // A code span is literal, so an entity left alone would be displayed as written.
        assertThat(DocumentationConverter.htmlToMarkdown("<code>&lt;tag&gt;</code>"), equalTo("`<tag>`"));
    }

    @Test
    public void decodesNumericEntities() {
        assertThat(DocumentationConverter.htmlToMarkdown("<p>a &#150; b</p>"), equalTo("a \u2013 b"));
        assertThat(DocumentationConverter.htmlToMarkdown("<p>&#x41;&#66;</p>"), equalTo("AB"));
    }

    @Test
    public void leavesUnrecognizedEntitiesAlone() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>&ExampleAccountId;</p>"),
            equalTo("&ExampleAccountId;")
        );
    }

    @Test
    public void preservesFencedCodeBlocks() {
        // Usage examples are appended to operation docs as fenced blocks. Their
        // indentation is significant and must survive untouched.
        String docs = """
                      <p>Registers a task.</p>
                      @example
                      ```javascript
                      const input = {
                        family: "STRING_VALUE",
                      };
                      ```
                      @public""";

        assertThat(
            DocumentationConverter.htmlToMarkdown(docs),
            equalTo(
                """
                Registers a task.

                @example
                ```javascript
                const input = {
                  family: "STRING_VALUE",
                };
                ```
                @public"""
            )
        );
    }

    @Test
    public void preservesTheLineStructureOfTsdocBlockTags() {
        assertThat(
            DocumentationConverter.htmlToMarkdown(
                "@throws {@link InvalidParameterException} (client fault)\n"
                    + " <p>The parameter is invalid.</p>\n\n@public"
            ),
            equalTo(
                "@throws {@link InvalidParameterException} (client fault)\n\n"
                    + "The parameter is invalid.\n\n@public"
            )
        );
    }

    @Test
    public void treatsABareAngleBracketAsText() {
        // Models write a literal '<' inside code.
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p><code><</code> compares.</p>"),
            equalTo("`<` compares.")
        );
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>if a < b use <code>x</code></p>"),
            equalTo("if a < b use `x`")
        );
    }

    @Test
    public void toleratesUnclosedElements() {
        assertThat(DocumentationConverter.htmlToMarkdown("<p>Unterminated"), equalTo("Unterminated"));
        assertThat(DocumentationConverter.htmlToMarkdown("<p>a <code>b</p>"), equalTo("a `b`"));
    }

    @Test
    public void toleratesStrayClosingTags() {
        assertThat(DocumentationConverter.htmlToMarkdown("Text</p>"), equalTo("Text"));
    }

    @Test
    public void convertsTheDocumentationFromTheReportedIssue() {
        // https://github.com/aws/aws-sdk-js-v3/issues/6876
        String docs = "<p>Registers a new task definition from the supplied <code>family</code> and "
            + "<code>containerDefinitions</code>. For more information about task definition "
            + "parameters and defaults, see <a href=\"https://docs.aws.amazon.com/AmazonECS/latest/"
            + "developerguide/task_defintions.html\">Amazon ECS Task Definitions</a> in the "
            + "<i>Amazon Elastic Container Service Developer Guide</i>.</p>";

        assertThat(
            DocumentationConverter.htmlToMarkdown(docs),
            equalTo(
                "Registers a new task definition from the supplied `family` and `containerDefinitions`. "
                    + "For more information about task definition parameters and defaults, see "
                    + "[Amazon ECS Task Definitions](https://docs.aws.amazon.com/AmazonECS/latest/"
                    + "developerguide/task_defintions.html) in the "
                    + "*Amazon Elastic Container Service Developer Guide*."
            )
        );
    }

    @Test
    public void unwrapsDocBookLinks() {
        // macie2 and pinpoint cross-reference their own docs this way.
        assertThat(
            DocumentationConverter.htmlToMarkdown(
                "<p>Replaced by the <link linkend=\"GetAdministratorAccount\">"
                    + "GetAdministratorAccount</link> operation.</p>"
            ),
            equalTo("Replaced by the GetAdministratorAccount operation.")
        );
    }

    @Test
    public void convertsBlockQuote() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("<blockquote>Just quoted.</blockquote>"),
            equalTo("> Just quoted.")
        );
        assertThat(
            DocumentationConverter.htmlToMarkdown(
                "<p>Intro</p><blockquote><p>One.</p><p>Two.</p></blockquote><p>After</p>"
            ),
            equalTo("Intro\n\n> One.\n>\n> Two.\n\nAfter")
        );
    }

    @Test
    public void convertsInlineQuote() {
        assertThat(
            DocumentationConverter.htmlToMarkdown("He said <q>hello</q> loudly."),
            equalTo("He said \"hello\" loudly.")
        );
    }

    @Test
    public void keepsTokensThatOnlyLookLikeTags() {
        // All real. wafv2, codebuild and kendra write these inside <code>.
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p> <code><label namespace>:<label from rule></code> </p>"),
            equalTo("`<label namespace>:<label from rule>`")
        );
        assertThat(
            DocumentationConverter.htmlToMarkdown(
                "<p>For example, <code><bucket-name>/<path>/<object-name>.zip</code>.</p>"
            ),
            equalTo("For example, `<bucket-name>/<path>/<object-name>.zip`.")
        );
        assertThat(
            DocumentationConverter.htmlToMarkdown("<p>Add the <code><HTML>content</HTML></code> tags.</p>"),
            equalTo("Add the `<HTML>content</HTML>` tags.")
        );
        assertThat(
            DocumentationConverter.htmlToMarkdown("Returns Array<string> and Promise<GetObjectCommandOutput>."),
            equalTo("Returns Array<string> and Promise<GetObjectCommandOutput>.")
        );
    }
}
