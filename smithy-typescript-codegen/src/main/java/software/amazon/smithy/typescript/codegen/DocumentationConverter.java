/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Converts the HTML in Smithy {@code documentation} traits into Markdown.
 *
 * <p>Models document shapes with HTML. VS Code drops HTML it doesn't recognize, so a
 * comment that is one &lt;p&gt; element shows nothing on hover. Editor hovers and TypeDoc
 * both render Markdown.
 *
 * <p>Fenced code blocks are left alone. Only the tags listed below are recognized;
 * anything else is copied byte for byte, so generics and placeholders like
 * &lt;bucket-name&gt; stay intact.
 */
@SmithyUnstableApi
final class DocumentationConverter {

    private static final Pattern TAG = Pattern.compile(
        "^<(?<closing>/?)(?<name>[A-Za-z][A-Za-z0-9-]*)(?<attributes>[^>]*?)/?>$",
        Pattern.DOTALL
    );

    private static final Pattern HREF = Pattern.compile(
        "href\\s*=\\s*(?:\"(?<double>[^\"]*)\"|'(?<single>[^']*)'|(?<bare>[^\\s\"'>]+))",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern DECIMAL_ENTITY = Pattern.compile("&#([0-9]{1,7});");
    private static final Pattern HEX_ENTITY = Pattern.compile("&#[xX]([0-9a-fA-F]{1,6});");
    private static final Pattern BLANK_LINE_RUN = Pattern.compile("\n{3,}");
    private static final Pattern TRAILING_SPACES = Pattern.compile("[ \t]+(?=\n)|[ \t]+$");
    private static final Pattern NEEDS_DELIMITED_URL = Pattern.compile(".*[\\s()].*", Pattern.DOTALL);

    /** Elements that open and close a paragraph of prose. */
    private static final Set<String> PARAGRAPHS = Set.of("p", "div", "section", "fullname");

    /** Elements with no formatting of their own. Dropped. */
    private static final Set<String> UNWRAPPED = Set.of(
        "span",
        "u",
        "small",
        "big",
        "font",
        "mark",
        "abbr",
        "cite",
        "dfn",
        "kbd",
        "samp",
        "var",
        "sub",
        "sup",
        "s",
        "strike",
        "del",
        "ins",
        "wbr",
        "nobr",
        "replaceable",
        // DocBook. <link linkend="Foo"> is a doc anchor, not a URL.
        "link"
    );

    /** Callout elements, rendered as labelled block quotes. */
    private static final Map<String, String> CALLOUTS = Map.of(
        "note",
        "Note",
        "important",
        "Important",
        "warning",
        "Warning",
        "caution",
        "Caution",
        "tip",
        "Tip"
    );

    /** Elements buffered so they can be rendered once their content is known. */
    private static final Set<String> BUFFERED = Set.of(
        "a",
        "b",
        "strong",
        "i",
        "em",
        "code",
        "pre",
        "li",
        "dt",
        "dd",
        "blockquote",
        "q"
    );

    /** Buffered elements that establish a block of prose. */
    private static final Set<String> BUFFERED_BLOCKS = Set.of("li", "dt", "dd", "pre", "blockquote");

    /** Buffered elements whose content Markdown treats literally. */
    private static final Set<String> LITERAL = Set.of("code", "pre");

    /**
     * Block elements whose closing tag ends an unclosed literal one.
     *
     * <p>&lt;p&gt;a &lt;code&gt;b&lt;/p&gt; is malformed. Browsers close the code element;
     * otherwise the stray tag lands inside the code span.
     */
    private static final Set<String> CLOSES_LITERAL = Set.of(
        "p",
        "div",
        "section",
        "fullname",
        "note",
        "important",
        "warning",
        "caution",
        "tip",
        "li",
        "dt",
        "dd",
        "blockquote",
        "ul",
        "ol",
        "dl",
        "table",
        "thead",
        "tbody",
        "tfoot",
        "tr",
        "th",
        "td",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6"
    );

    /** Elements handled by the switch in {@code element}. */
    private static final Set<String> STRUCTURAL = Set.of(
        "ul",
        "ol",
        "dl",
        "br",
        "hr",
        "table",
        "thead",
        "tbody",
        "tfoot",
        "tr",
        "th",
        "td",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6"
    );

    /** Everything we understand. Anything else is content. */
    private static final Set<String> RECOGNIZED = Stream.of(
        PARAGRAPHS,
        UNWRAPPED,
        BUFFERED,
        CALLOUTS.keySet(),
        STRUCTURAL
    )
        .flatMap(Set::stream)
        .collect(Collectors.toUnmodifiableSet());

    /** 0x80-0x9F are undefined in HTML, but tools emit them for Windows-1252 punctuation. */
    private static final Map<Integer, Integer> WINDOWS_1252 = Map.ofEntries(
        Map.entry(0x82, 0x201A),
        Map.entry(0x84, 0x201E),
        Map.entry(0x85, 0x2026),
        Map.entry(0x88, 0x02C6),
        Map.entry(0x8B, 0x2039),
        Map.entry(0x91, 0x2018),
        Map.entry(0x92, 0x2019),
        Map.entry(0x93, 0x201C),
        Map.entry(0x94, 0x201D),
        Map.entry(0x95, 0x2022),
        Map.entry(0x96, 0x2013),
        Map.entry(0x97, 0x2014),
        Map.entry(0x98, 0x02DC),
        Map.entry(0x99, 0x2122),
        Map.entry(0x9B, 0x203A)
    );

    private static final String FENCE = "```";

    private DocumentationConverter() {}

    /**
     * Converts the HTML in a documentation string to Markdown.
     *
     * <p>Input with no markup or entities comes back unchanged.
     *
     * @param documentation documentation text, which may contain HTML markup.
     * @return the equivalent Markdown.
     */
    static String htmlToMarkdown(String documentation) {
        if (documentation == null || documentation.isEmpty()) {
            return documentation;
        }
        if (documentation.indexOf('<') < 0 && documentation.indexOf('&') < 0) {
            return documentation;
        }

        StringBuilder result = new StringBuilder();
        int position = 0;

        // Skip fenced blocks. Generated usage examples need their indentation.
        while (position < documentation.length()) {
            int fenceStart = documentation.indexOf(FENCE, position);
            if (fenceStart < 0) {
                result.append(convert(documentation.substring(position)));
                break;
            }

            int fenceEnd = documentation.indexOf(FENCE, fenceStart + FENCE.length());
            if (fenceEnd < 0) {
                // Unterminated fence. Copy the rest through.
                result.append(convert(documentation.substring(position, fenceStart)))
                    .append(documentation, fenceStart, documentation.length());
                break;
            }

            result.append(convert(documentation.substring(position, fenceStart)))
                .append(documentation, fenceStart, fenceEnd + FENCE.length());
            position = fenceEnd + FENCE.length();
        }

        return result.toString().strip();
    }

    private static String convert(String html) {
        Renderer renderer = new Renderer();
        int position = 0;

        while (position < html.length()) {
            if (html.charAt(position) != '<') {
                int next = html.indexOf('<', position);
                if (next < 0) {
                    next = html.length();
                }
                renderer.text(html.substring(position, next));
                position = next;
                continue;
            }

            int close = html.indexOf('>', position);
            String raw = close < 0 ? null : html.substring(position, close + 1);
            Matcher matcher = raw == null ? null : TAG.matcher(raw);

            if (matcher != null && matcher.matches()) {
                renderer.element(
                    matcher.group("name").toLowerCase(Locale.ROOT),
                    !matcher.group("closing").isEmpty(),
                    matcher.group("attributes"),
                    raw
                );
                position = close + 1;
            } else {
                // Literal '<'. Take one character; reading to the next '>' would eat
                // any tags in between. Models write things like <code><</code>.
                renderer.text("<");
                position++;
            }
        }

        return tidy(renderer.finish());
    }

    /** Collapses runs of blank lines and removes trailing spaces left by conversion. */
    private static String tidy(String markdown) {
        String tidied = BLANK_LINE_RUN.matcher(markdown).replaceAll("\n\n");
        return TRAILING_SPACES.matcher(tidied).replaceAll("");
    }

    /**
     * Decodes HTML entities.
     *
     * <p>Numeric entities always decode. Named ones only decode in a literal context like
     * a code span, where the entity would otherwise show as-is. Elsewhere Markdown
     * renderers handle them, and decoding would put back a bare '&amp;' or '&lt;'.
     */
    private static String decodeEntities(String text, boolean literalContext) {
        if (text.indexOf('&') < 0) {
            return text;
        }

        // MatchResult.group(String) is Java 20+, so address the group by index. The
        // replacement is quoted because '$' and '\' are special there, and a numeric
        // entity can decode to either.
        String decoded = HEX_ENTITY.matcher(text)
            .replaceAll(match -> Matcher.quoteReplacement(codePointToString(Integer.parseInt(match.group(1), 16))));
        decoded = DECIMAL_ENTITY.matcher(decoded)
            .replaceAll(match -> Matcher.quoteReplacement(codePointToString(Integer.parseInt(match.group(1)))));
        decoded = decoded.replace("&nbsp;", " ");

        if (literalContext) {
            decoded = decoded.replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&apos;", "'")
                .replace("&amp;", "&");
        }

        return decoded;
    }

    private static String codePointToString(int codePoint) {
        int resolved = WINDOWS_1252.getOrDefault(codePoint, codePoint);
        if (!Character.isValidCodePoint(resolved)) {
            return "";
        }
        return new String(Character.toChars(resolved));
    }

    /** An element whose content is being collected before it can be rendered. */
    private record Frame(String name, String href) {}

    /** Tracks whether a list is ordered and, if so, the number of the next item. */
    private static final class ListState {
        private final boolean ordered;
        private int counter = 1;

        private ListState(boolean ordered) {
            this.ordered = ordered;
        }
    }

    private static final class Renderer {
        private final Deque<StringBuilder> buffers = new ArrayDeque<>();
        private final Deque<Frame> frames = new ArrayDeque<>();
        private final Deque<ListState> lists = new ArrayDeque<>();

        /** Greater than zero while inside an element that establishes a block of prose. */
        private int blockDepth;

        /** Greater than zero while inside content that Markdown treats literally. */
        private int literalDepth;

        private Renderer() {
            buffers.push(new StringBuilder());
        }

        private StringBuilder out() {
            return buffers.peek();
        }

        private void text(String text) {
            if (text.isEmpty()) {
                return;
            }

            if (literalDepth > 0) {
                out().append(decodeEntities(text, true));
                return;
            }

            String decoded = decodeEntities(text, false);

            // Outside a block this is a TSDoc tag or caption, not prose. Keep the lines.
            if (blockDepth == 0) {
                out().append(decoded);
                return;
            }

            // Collapse whitespace, as HTML does. Also stops the deep indentation in
            // model files reading as a code block.
            String collapsed = WHITESPACE.matcher(decoded).replaceAll(" ");
            if (collapsed.startsWith(" ") && atLineBoundaryOrSpace()) {
                collapsed = collapsed.substring(1);
            }
            out().append(collapsed);
        }

        private void element(String name, boolean closing, String attributes, String raw) {
            if (literalDepth > 0) {
                boolean closesOpenLiteral = closing && LITERAL.contains(name) && isOpen(name);
                boolean recovers = closing && !closesOpenLiteral && CLOSES_LITERAL.contains(name);

                if (!closesOpenLiteral && !recovers) {
                    if (RECOGNIZED.contains(name)) {
                        // No formatting inside a code span. Drop the tag, keep the
                        // text -- models italicize the variable parts of an ARN.
                        return;
                    }
                    // Unrecognized, so it's content -- a <bucket-name> placeholder.
                    out().append(raw);
                    return;
                }

                if (recovers) {
                    while (literalDepth > 0 && !frames.isEmpty()) {
                        flushFrame();
                    }
                }
                // Fall through and handle it normally.
            }

            if (UNWRAPPED.contains(name)) {
                return;
            }

            if (BUFFERED.contains(name)) {
                if (closing) {
                    closeBuffered(name);
                } else {
                    openBuffered(name, attributes);
                }
                return;
            }

            if (CALLOUTS.containsKey(name)) {
                if (closing) {
                    if (isOpen(name)) {
                        closeBuffered(name);
                    }
                } else {
                    buffers.push(new StringBuilder());
                    frames.push(new Frame(name, null));
                    blockDepth++;
                }
                return;
            }

            if (PARAGRAPHS.contains(name)) {
                if (closing) {
                    exitBlock();
                    blankLine();
                } else {
                    blankLine();
                    blockDepth++;
                }
                return;
            }

            switch (name) {
                case "ul", "ol" -> {
                    if (closing) {
                        if (!lists.isEmpty()) {
                            lists.pop();
                        }
                    } else {
                        blankLine();
                        lists.push(new ListState(name.equals("ol")));
                    }
                    blankLine();
                }
                case "dl" -> blankLine();
                case "br" -> {
                    if (!closing) {
                        blankLine();
                    }
                }
                case "hr" -> {
                    if (!closing) {
                        blankLine();
                        out().append("---");
                        blankLine();
                    }
                }
                case "h1", "h2", "h3", "h4", "h5", "h6" -> {
                    if (closing) {
                        exitBlock();
                        blankLine();
                    } else {
                        blankLine();
                        out().append("#".repeat(name.charAt(1) - '0')).append(' ');
                        blockDepth++;
                    }
                }
                case "table", "thead", "tbody", "tfoot", "tr" -> blankLine();
                case "th", "td" -> {
                    if (closing) {
                        exitBlock();
                    } else {
                        newLine();
                        blockDepth++;
                    }
                }
                // Not a tag we know, so it's content. A generic or a placeholder.
                default -> out().append(raw);
            }
        }

        private boolean isOpen(String name) {
            return frames.stream().anyMatch(frame -> frame.name().equals(name));
        }

        private void exitBlock() {
            blockDepth = Math.max(0, blockDepth - 1);
        }

        private void openBuffered(String name, String attributes) {
            buffers.push(new StringBuilder());
            frames.push(new Frame(name, name.equals("a") ? href(attributes) : null));

            if (LITERAL.contains(name)) {
                literalDepth++;
            }
            if (BUFFERED_BLOCKS.contains(name)) {
                blockDepth++;
            }
        }

        private void closeBuffered(String name) {
            if (!isOpen(name)) {
                // Closing tag with nothing open. Drop it.
                return;
            }

            // Render anything the markup left unclosed.
            while (!frames.peek().name().equals(name)) {
                flushFrame();
            }
            flushFrame();
        }

        private void flushFrame() {
            Frame frame = frames.pop();
            String content = buffers.pop().toString();
            String name = frame.name();

            if (LITERAL.contains(name)) {
                literalDepth--;
            }
            if (BUFFERED_BLOCKS.contains(name) || CALLOUTS.containsKey(name)) {
                exitBlock();
            }

            switch (name) {
                case "a" -> link(content, frame.href());
                case "b", "strong" -> emphasize(content, "**");
                case "i", "em" -> emphasize(content, "*");
                case "code" -> codeSpan(content);
                case "pre" -> codeBlock(content);
                case "li" -> listItem(content);
                case "dt" -> term(content);
                case "dd" -> definition(content);
                case "blockquote" -> blockQuote(content);
                case "q" -> out().append('"').append(content.strip()).append('"');
                default -> {
                    String label = CALLOUTS.get(name);
                    if (label != null) {
                        callout(content, label);
                    } else {
                        out().append(content);
                    }
                }
            }
        }

        private void link(String content, String href) {
            String text = content.strip();
            String target = href == null ? null : decodeEntities(href, true).strip();

            if (target == null || target.isEmpty()) {
                out().append(text);
                return;
            }
            if (text.isEmpty()) {
                text = target;
            }

            // Whitespace or parens in the destination need delimiting.
            String destination = NEEDS_DELIMITED_URL.matcher(target).matches() ? "<" + target + ">" : target;
            out().append('[').append(text.replace("]", "\\]")).append("](").append(destination).append(')');
        }

        private void emphasize(String content, String marker) {
            int start = 0;
            while (start < content.length() && Character.isWhitespace(content.charAt(start))) {
                start++;
            }
            int end = content.length();
            while (end > start && Character.isWhitespace(content.charAt(end - 1))) {
                end--;
            }

            if (start == end) {
                // Empty emphasis. Keep the whitespace it stood for.
                if (!content.isEmpty() && !atLineBoundaryOrSpace()) {
                    out().append(' ');
                }
                return;
            }

            // Delimiters have to hug the text, so move surrounding whitespace out.
            if (start > 0 && !atLineBoundaryOrSpace()) {
                out().append(' ');
            }
            out().append(marker).append(content, start, end).append(marker);
            if (end < content.length()) {
                out().append(' ');
            }
        }

        private void codeSpan(String content) {
            // Code spans are inline and a newline renders as a space. Collapsing also
            // avoids a blank line, which would end the span.
            String code = WHITESPACE.matcher(content).replaceAll(" ").strip();
            if (code.isEmpty()) {
                return;
            }

            // Needs more backticks than the content contains.
            StringBuilder delimiter = new StringBuilder("`");
            while (code.contains(delimiter)) {
                delimiter.append('`');
            }
            String padding = code.startsWith("`") || code.endsWith("`") ? " " : "";
            out().append(delimiter).append(padding).append(code).append(padding).append(delimiter);
        }

        private void codeBlock(String content) {
            String code = content.strip();
            if (code.isEmpty()) {
                return;
            }
            blankLine();
            out().append(FENCE).append('\n').append(code).append('\n').append(FENCE);
            blankLine();
        }

        private void listItem(String content) {
            String item = content.strip();
            if (item.isEmpty()) {
                return;
            }

            ListState list = lists.peek();
            String marker = list != null && list.ordered ? (list.counter++) + ". " : "- ";

            newLine();
            out().append(marker).append(indentContinuation(item, " ".repeat(marker.length())));
        }

        private void term(String content) {
            String term = content.strip();
            if (term.isEmpty()) {
                return;
            }
            blankLine();
            out().append("- **").append(term).append("**");
        }

        private void definition(String content) {
            String definition = content.strip();
            if (definition.isEmpty()) {
                return;
            }
            newLine();
            out().append('\n').append(indentAll(definition, "  "));
            blankLine();
        }

        private void callout(String content, String label) {
            String body = content.strip();
            blankLine();
            if (body.isEmpty()) {
                out().append("> **").append(label).append(":**");
            } else if (body.contains("\n")) {
                out().append("> **").append(label).append(":**\n>\n").append(indentAll(body, "> "));
            } else {
                out().append("> **").append(label).append(":** ").append(body);
            }
            blankLine();
        }

        private void blockQuote(String content) {
            String body = content.strip();
            if (body.isEmpty()) {
                return;
            }
            blankLine();
            out().append(indentAll(body, "> "));
            blankLine();
        }

        /**
         * True when the next character written would start a line or follow a space.
         *
         * <p>Searches buffers outwards. An inline &lt;b&gt; starts with an empty buffer
         * while still mid-sentence, so without looking out we'd drop the space before it.
         */
        private boolean atLineBoundaryOrSpace() {
            for (StringBuilder buffer : buffers) {
                if (buffer.length() == 0) {
                    continue;
                }
                char last = buffer.charAt(buffer.length() - 1);
                return last == '\n' || last == ' ';
            }
            return true;
        }

        private void newLine() {
            StringBuilder buffer = out();
            stripTrailingSpaces(buffer);
            if (buffer.length() > 0 && buffer.charAt(buffer.length() - 1) != '\n') {
                buffer.append('\n');
            }
        }

        private void blankLine() {
            StringBuilder buffer = out();
            stripTrailingSpaces(buffer);
            if (buffer.length() == 0) {
                return;
            }
            newLine();
            if (buffer.length() == 1 || buffer.charAt(buffer.length() - 2) != '\n') {
                buffer.append('\n');
            }
        }

        private static void stripTrailingSpaces(StringBuilder buffer) {
            int end = buffer.length();
            while (end > 0 && (buffer.charAt(end - 1) == ' ' || buffer.charAt(end - 1) == '\t')) {
                end--;
            }
            buffer.setLength(end);
        }

        /** Indents every line but the first, to align a list item's continuation. */
        private static String indentContinuation(String text, String indent) {
            return text.replace("\n", "\n" + indent);
        }

        /** Indents every line, including the first. */
        private static String indentAll(String text, String indent) {
            return indent + text.replace("\n", "\n" + indent);
        }

        private static String href(String attributes) {
            Matcher matcher = HREF.matcher(attributes);
            if (!matcher.find()) {
                return null;
            }
            String value = matcher.group("double");
            if (value == null) {
                value = matcher.group("single");
            }
            if (value == null) {
                value = matcher.group("bare");
            }
            return value;
        }

        private String finish() {
            // Flush anything malformed markup left open.
            while (!frames.isEmpty()) {
                flushFrame();
            }
            while (buffers.size() > 1) {
                String orphan = buffers.pop().toString();
                out().append(orphan);
            }
            return out().toString();
        }
    }
}
