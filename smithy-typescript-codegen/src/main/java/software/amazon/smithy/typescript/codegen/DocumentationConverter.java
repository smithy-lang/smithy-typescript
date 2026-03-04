/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.util.regex.Pattern;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Converts HTML documentation strings from Smithy model {@code @documentation}
 * traits into plain-text suitable for JSDoc comments.
 *
 * <p>The Smithy documentation trait values often contain HTML markup (e.g.
 * {@code <p>}, {@code <a>}, {@code <code>}, {@code <ul>/<li>}). This class
 * strips that markup while preserving readable formatting so that IDE hover
 * docs are clean and legible.
 */
@SmithyUnstableApi
final class DocumentationConverter {

    // Block-level elements that should produce paragraph breaks.
    private static final Pattern BLOCK_BREAK = Pattern.compile(
        "<\\s*/?(p|br|h[1-6]|div|section|article|header|footer|nav|aside|main|blockquote|pre|hr|table|thead|tbody|tfoot|tr)\\b[^>]*/?>",
        Pattern.CASE_INSENSITIVE
    );

    // List items get a leading dash for readability.
    private static final Pattern LIST_ITEM_OPEN = Pattern.compile(
        "<\\s*li\\b[^>]*>",
        Pattern.CASE_INSENSITIVE
    );

    // Closing list item tags.
    private static final Pattern LIST_ITEM_CLOSE = Pattern.compile(
        "<\\s*/li\\s*>",
        Pattern.CASE_INSENSITIVE
    );

    // <ul>, <ol>, <dl> open/close tags — just remove them.
    private static final Pattern LIST_WRAPPER = Pattern.compile(
        "<\\s*/?(ul|ol|dl)\\b[^>]*>",
        Pattern.CASE_INSENSITIVE
    );

    // <dt> becomes a newline + bold-ish label, <dd> becomes indented.
    private static final Pattern DT_TAG = Pattern.compile(
        "<\\s*dt\\b[^>]*>",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DT_CLOSE = Pattern.compile(
        "<\\s*/dt\\s*>",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DD_TAG = Pattern.compile(
        "<\\s*dd\\b[^>]*>",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DD_CLOSE = Pattern.compile(
        "<\\s*/dd\\s*>",
        Pattern.CASE_INSENSITIVE
    );

    // <code> and <pre> content is wrapped in backticks.
    private static final Pattern CODE_OPEN = Pattern.compile(
        "<\\s*(code|pre)\\b[^>]*>",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern CODE_CLOSE = Pattern.compile(
        "<\\s*/(code|pre)\\s*>",
        Pattern.CASE_INSENSITIVE
    );

    // <b>, <strong>, <i>, <em> — just strip them (no markdown equivalent in JSDoc).
    private static final Pattern INLINE_FORMAT = Pattern.compile(
        "<\\s*/?(b|strong|i|em|u|s|strike|del|ins|sub|sup|small|big|span|font|mark|abbr|cite|dfn|kbd|samp|var|wbr)\\b[^>]*>",
        Pattern.CASE_INSENSITIVE
    );

    // Anchor tags: extract the link text, drop the URL.
    private static final Pattern ANCHOR = Pattern.compile(
        "<\\s*a\\b[^>]*>(.*?)<\\s*/a\\s*>",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );

    // <th> and <td> — separate cells with a tab-like space.
    private static final Pattern TABLE_CELL = Pattern.compile(
        "<\\s*/?(th|td)\\b[^>]*>",
        Pattern.CASE_INSENSITIVE
    );

    // Any remaining HTML tags.
    private static final Pattern ANY_TAG = Pattern.compile("<[^>]+>");

    // HTML entities.
    private static final Pattern ENTITY_AMP = Pattern.compile("&amp;", Pattern.CASE_INSENSITIVE);
    private static final Pattern ENTITY_LT = Pattern.compile("&lt;", Pattern.CASE_INSENSITIVE);
    private static final Pattern ENTITY_GT = Pattern.compile("&gt;", Pattern.CASE_INSENSITIVE);
    private static final Pattern ENTITY_QUOT = Pattern.compile("&quot;", Pattern.CASE_INSENSITIVE);
    private static final Pattern ENTITY_APOS = Pattern.compile("&#39;|&apos;", Pattern.CASE_INSENSITIVE);
    private static final Pattern ENTITY_NBSP = Pattern.compile("&nbsp;", Pattern.CASE_INSENSITIVE);
    private static final Pattern ENTITY_NUMERIC = Pattern.compile("&#(\\d+);");
    private static final Pattern ENTITY_HEX = Pattern.compile("&#x([0-9a-fA-F]+);");

    // Collapse runs of blank lines into at most two newlines (one blank line).
    private static final Pattern EXCESS_NEWLINES = Pattern.compile("\\n{3,}");
    // Collapse runs of spaces/tabs on a single line.
    private static final Pattern EXCESS_SPACES = Pattern.compile("[ \\t]{2,}");
    // Trailing whitespace on each line.
    private static final Pattern TRAILING_WS = Pattern.compile("[ \\t]+$", Pattern.MULTILINE);

    private DocumentationConverter() {}

    /**
     * Converts an HTML documentation string to plain text suitable for JSDoc.
     *
     * @param html the raw HTML documentation value from a Smithy model
     * @return a plain-text version with HTML tags removed and basic formatting preserved
     */
    static String htmlToPlainText(String html) {
        if (html == null || html.isEmpty()) {
            return html;
        }

        String s = html;

        // Anchors — keep link text only.
        s = ANCHOR.matcher(s).replaceAll("$1");

        // <code>/<pre> → backtick-wrapped.
        s = CODE_OPEN.matcher(s).replaceAll("`");
        s = CODE_CLOSE.matcher(s).replaceAll("`");

        // List items → newline + dash.
        s = LIST_ITEM_OPEN.matcher(s).replaceAll("\n -  ");
        s = LIST_ITEM_CLOSE.matcher(s).replaceAll("");

        // Definition list elements.
        s = DT_TAG.matcher(s).replaceAll("\n");
        s = DT_CLOSE.matcher(s).replaceAll(" - ");
        s = DD_TAG.matcher(s).replaceAll("   ");
        s = DD_CLOSE.matcher(s).replaceAll("");

        // List wrappers.
        s = LIST_WRAPPER.matcher(s).replaceAll("\n");

        // Table cells — add spacing.
        s = TABLE_CELL.matcher(s).replaceAll("  ");

        // Block-level elements → paragraph break.
        s = BLOCK_BREAK.matcher(s).replaceAll("\n\n");

        // Inline formatting tags — just remove.
        s = INLINE_FORMAT.matcher(s).replaceAll("");

        // Any remaining tags.
        s = ANY_TAG.matcher(s).replaceAll("");

        // Decode HTML entities.
        s = ENTITY_NBSP.matcher(s).replaceAll(" ");
        s = ENTITY_LT.matcher(s).replaceAll("<");
        s = ENTITY_GT.matcher(s).replaceAll(">");
        s = ENTITY_QUOT.matcher(s).replaceAll("\"");
        s = ENTITY_APOS.matcher(s).replaceAll("'");
        s = ENTITY_HEX.matcher(s).replaceAll(mr -> {
            int codePoint = Integer.parseInt(mr.group(1), 16);
            return String.valueOf((char) codePoint);
        });
        s = ENTITY_NUMERIC.matcher(s).replaceAll(mr -> {
            int codePoint = Integer.parseInt(mr.group(1));
            return String.valueOf((char) codePoint);
        });
        // &amp; must be last to avoid double-decoding.
        s = ENTITY_AMP.matcher(s).replaceAll("&");

        // Normalize whitespace.
        s = TRAILING_WS.matcher(s).replaceAll("");
        s = EXCESS_SPACES.matcher(s).replaceAll(" ");
        s = EXCESS_NEWLINES.matcher(s).replaceAll("\n\n");

        return s.trim();
    }
}
