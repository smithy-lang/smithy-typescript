/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.util;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Java port of PatternDetection.js compression algorithm.
 *
 * Compresses a JSON ObjectNode by extracting repeated patterns into
 * reusable JavaScript variables, producing JS code that reconstitutes
 * the original object.
 */
@SmithyInternalApi
public class PatternDetectionCompression {

    /**
     * Alphabet available to the variable name generator.
     * omits "r" for other use.
     */
    private static final String ALPHABET =
        "abcdefghijklmnopqstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final Pattern WORD_ONLY_KEY = Pattern.compile("\"(\\w+)\":");
    private static final Pattern SSA_PATTERN = Pattern.compile("_ssa_(\\d{1,2})");

    private final ObjectNode objectNode;

    /**
     * Variable ID to code block string.
     */
    private final Map<Integer, String> varIdToBlock = new LinkedHashMap<>();

    /**
     * Reverse map of code block string to variable id.
     */
    private final Map<String, Integer> blockToVarId = new LinkedHashMap<>();

    /**
     * Number of times each variable has been detected in the JSON blob.
     */
    private final Map<Integer, Integer> varIdToCount = new LinkedHashMap<>();

    /**
     * Unique JSON path mapped to the variable that can replace it.
     */
    private final Map<String, Integer> pathToVarId = new LinkedHashMap<>();

    /**
     * Set of unique paths encountered in the JSON object.
     */
    private final Set<String> pathsSeen = new LinkedHashSet<>();

    /**
     * Set of variables that actually get used (as opposed to only marked).
     * These will be assigned symbols for write output.
     */
    private final Set<Integer> variableIdsUsed = new LinkedHashSet<>();

    /**
     * Map of object key strings to their assigned variable id.
     */
    private final Map<String, Integer> keyToVarId = new LinkedHashMap<>();

    /**
     * Next available variable id. Increments when used.
     */
    private int variableId = 0;

    /**
     * Tracks the next available variable name, e.g.
     * a, b, ... z, A ... Z, aa, ab, ac, ad ...
     */
    private int[] varName = {0};

    /**
     * 'read' or 'write' mode.
     */
    private String mode = "read";

    private final Map<String, Integer> writeReplacements = new LinkedHashMap<>();

    /**
     * For SSA replacements, tracks the SSA number for each replaced path.
     */
    private final Map<String, String> writeReplacementSsaNum = new LinkedHashMap<>();

    /**
     * Maps a normalized SSA block (with _ssa_N replaced by _ssa_) to the set of
     * actual SSA numbers seen, enabling template function generation.
     */
    private final Map<String, List<String>> ssaTemplateNumbers = new LinkedHashMap<>();

    /**
     * Maps original block strings to their SSA-normalized form.
     */
    private final Map<String, String> blockToSsaNormalized = new LinkedHashMap<>();

    public PatternDetectionCompression(ObjectNode objectNode) {
        this.objectNode = objectNode;
    }

    /**
     * @return JS code that evaluates to an exact match of the original object.
     */
    public String compress() {
        // First pass: read
        traverse(objectNode, "", null);

        // Second pass: write (collect replacements)
        mode = "write";
        traverse(objectNode, "", null);
        mode = "read";

        // Apply replacements and serialize
        Node replaced = applyReplacements(objectNode, "");

        // Serialize modified clone and strip quotes from word-only keys
        String serialized = jsonStringify(replaced);
        String buffer = "const _data=" + stripWordOnlyKeyQuotes(serialized) + ";";

        // Sort used variable IDs: numbers/strings first, then booleans, then objects, then arrays
        List<Integer> orderedVariableIds = getOrderedVariableIds();

        // Code blocks
        List<String> codeBlockBuffer = new ArrayList<>();
        for (int variableIdVal : orderedVariableIds) {
            String symbol = nextVariableName();
            String block = varIdToBlock.get(variableIdVal);

            // Check if this is an SSA template
            if (ssaTemplateNumbers.containsKey(block)) {
                // Emit a template function: symbol=(n)=>"prefix_ssa_"+n+"suffix"
                String inner = block.substring(1, block.length() - 1); // strip quotes
                String[] parts = inner.split("_ssa_", -1);
                StringBuilder templateBody = new StringBuilder("\"");
                for (int i = 0; i < parts.length; ++i) {
                    if (i > 0) {
                        templateBody.append("_ssa_\"+n+\"");
                    }
                    templateBody.append(parts[i]);
                }
                templateBody.append("\"");
                codeBlockBuffer.add(symbol + "=(n: number)=>" + templateBody);

                // Replace SSA placeholders with function calls
                Pattern ssaPlaceholder = Pattern.compile(
                    "\"__REPLACE__" + variableIdVal + "__SSA__(\\d{1,2})__REPLACE__\""
                );
                Matcher ssaM = ssaPlaceholder.matcher(buffer);
                StringBuilder sb = new StringBuilder();
                while (ssaM.find()) {
                    ssaM.appendReplacement(sb, symbol + "(" + ssaM.group(1) + ")");
                }
                ssaM.appendTail(sb);
                buffer = sb.toString();
            } else {
                codeBlockBuffer.add(symbol + "=" + block);
            }

            // Replace non-SSA placeholders
            buffer = buffer.replace(
                "\"__REPLACE__" + variableIdVal + "__REPLACE__\"",
                symbol
            );
        }

        // Cross-reference code blocks
        for (int i = 0; i < codeBlockBuffer.size(); ++i) {
            int iIndex = codeBlockBuffer.get(i).indexOf("=");
            String iSymbol = codeBlockBuffer.get(i).substring(0, iIndex);
            String iCode = codeBlockBuffer.get(i).substring(iIndex + 1);

            for (int j = i + 1; j < codeBlockBuffer.size(); ++j) {
                int jIndex = codeBlockBuffer.get(j).indexOf("=");
                String jCode = codeBlockBuffer.get(j).substring(jIndex + 1);

                if (jCode.contains(iCode)) {
                    if (iCode.charAt(0) != '"' && iCode.length() < 6) {
                        continue;
                    }

                    String escapedICode = Pattern.quote(iCode);
                    String keyPattern = escapedICode + ":([^ ])";
                    codeBlockBuffer.set(
                        j,
                        codeBlockBuffer.get(j).replaceAll(keyPattern, "[" + iSymbol + "]:$1")
                    );

                    codeBlockBuffer.set(
                        j,
                        codeBlockBuffer.get(j).replace(iCode, iSymbol)
                    );
                }
            }
        }

        if (!codeBlockBuffer.isEmpty()) {
            buffer = "const " + String.join(",\n", codeBlockBuffer) + ";\n" + buffer;
        }

        // Object keys
        List<String> keyVarBuffer = new ArrayList<>();
        for (String key : keyToVarId.keySet()) {
            Pattern keyPattern = Pattern.compile(Pattern.quote("\"" + key + "\":"));
            Matcher matcher = keyPattern.matcher(buffer);
            int count = 0;
            while (matcher.find()) {
                count += 1;
            }

            if (count > 1 && (long) key.length() * count > 8) {
                String symbol = nextVariableName();
                keyVarBuffer.add(symbol + "=\"" + key + "\"");
                buffer = buffer.replaceAll(
                    "\"?" + Pattern.quote(key) + "\"?:([^ ])",
                    "[" + symbol + "]:$1"
                );
            }
        }
        if (!keyVarBuffer.isEmpty()) {
            buffer = "const " + String.join(",\n", keyVarBuffer) + ";\n" + buffer;
        }

        buffer = prettyPrintData(buffer);
        buffer += "\n";

        return buffer;
    }

    /**
     * Allocates the next unique variable id.
     */
    private int markVariableId() {
        return variableId++;
    }

    /**
     * Allocates the next required variable name for code output.
     */
    private String nextVariableName() {
        StringBuilder out = new StringBuilder();
        for (int i = varName.length - 1; i >= 0; --i) {
            out.append(ALPHABET.charAt(varName[i]));
        }

        boolean carry = false;
        for (int i = 0; i < varName.length; ++i) {
            int n = varName[i];
            if (n >= ALPHABET.length() - 1) {
                varName[i] = 0;
                carry = true;
                continue;
            }
            if (carry) {
                varName[i] += 1;
                carry = false;
            } else {
                varName[i] += 1;
                break;
            }
        }
        if (carry) {
            int[] newVarName = new int[varName.length + 1];
            System.arraycopy(varName, 0, newVarName, 0, varName.length);
            newVarName[varName.length] = 0;
            varName = newVarName;
        }
        return out.toString();
    }

    private static String jsonStringify(Node node) {
        return Node.printJson(node);
    }

    /**
     * Recursive.
     * @param node - the current node in traversal.
     * @param path - the unique JSON path to the current node.
     * @param key - the object key for this node, if available.
     */
    private void traverse(Node node, String path, String key) {
        Integer optionalReplace = work(node, path, key);
        if (optionalReplace != null) {
            variableIdsUsed.add(optionalReplace);
            writeReplacements.put(path, optionalReplace);
            // If this is an SSA string, record which number it uses.
            if (node.isStringNode()) {
                String block = jsonStringify(node);
                if (blockToSsaNormalized.containsKey(block)) {
                    Matcher ssaM = SSA_PATTERN.matcher(block);
                    if (ssaM.find()) {
                        writeReplacementSsaNum.put(path, ssaM.group(1));
                    }
                }
            }
            return;
        }

        if (node.isArrayNode()) {
            ArrayNode arrayNode = node.expectArrayNode();
            List<Node> elements = arrayNode.getElements();
            for (int i = 0; i < elements.size(); ++i) {
                traverse(elements.get(i), path + "[" + i + "]", null);
            }
        } else if (node.isObjectNode()) {
            ObjectNode objNode = node.expectObjectNode();
            objNode.getMembers().forEach((k, v) -> {
                String keyStr = k.getValue();
                traverse(v, path + "[`" + keyStr + "`]", keyStr);
            });
        }
    }

    /**
     * Actions on a node during traversal.
     */
    private Integer work(Node node, String path, String key) {
        if ("read".equals(mode)) {
            return read(node, path, key);
        } else if ("write".equals(mode)) {
            return write(node, path);
        }
        return null;
    }

    /**
     * Scan the current node and note its unique JSON
     * representation. Allocate variables to the JSON strings.
     */
    private Integer read(Node node, String path, String key) {
        String block = jsonStringify(node);
        if (pathsSeen.contains(path)) {
            throw new RuntimeException("already seen: " + path);
        }
        pathsSeen.add(path);

        if (key != null) {
            int varId = markVariableId();
            keyToVarId.put(key, varId);
            varIdToBlock.put(varId, key);
        }

        // For strings containing _ssa_N, normalize to group them together.
        String lookupBlock = block;
        if (node.isStringNode()) {
            Matcher ssaM = SSA_PATTERN.matcher(block);
            if (ssaM.find()) {
                String normalized = SSA_PATTERN.matcher(block).replaceAll("_ssa_");
                lookupBlock = normalized;
                blockToSsaNormalized.put(block, normalized);
                String num = ssaM.group(1);
                ssaTemplateNumbers.computeIfAbsent(normalized, k -> new ArrayList<>()).add(num);
            }
        }

        if (blockToVarId.containsKey(lookupBlock)) {
            int varId = blockToVarId.get(lookupBlock);
            varIdToCount.put(varId, varIdToCount.get(varId) + 1);
        } else {
            int varId = markVariableId();
            blockToVarId.put(lookupBlock, varId);
            varIdToBlock.put(varId, lookupBlock);
            varIdToCount.put(varId, 1);
            pathToVarId.put(path, varId);
        }
        return null;
    }

    /**
     * Check whether the node is worth replacing with
     * a previously recorded variable id.
     * @return variable id if replacement is desired, otherwise null.
     */
    private Integer write(Node node, String path) {
        String block = jsonStringify(node);
        String lookupBlock = blockToSsaNormalized.getOrDefault(block, block);

        if (blockToVarId.containsKey(lookupBlock)) {
            int variable = blockToVarId.get(lookupBlock);
            int count = varIdToCount.get(variable);
            if (count >= 2 && (long) lookupBlock.length() * count >= 10) {
                return variable;
            }
        }
        return null;
    }

    private Node applyReplacements(Node node, String path) {
        if (writeReplacements.containsKey(path)) {
            int varId = writeReplacements.get(path);
            String ssaNum = writeReplacementSsaNum.get(path);
            if (ssaNum != null) {
                return Node.from("__REPLACE__" + varId + "__SSA__" + ssaNum + "__REPLACE__");
            }
            return Node.from("__REPLACE__" + varId + "__REPLACE__");
        }

        if (node.isArrayNode()) {
            ArrayNode arrayNode = node.expectArrayNode();
            List<Node> elements = arrayNode.getElements();
            List<Node> newElements = new ArrayList<>();
            for (int i = 0; i < elements.size(); ++i) {
                newElements.add(applyReplacements(elements.get(i), path + "[" + i + "]"));
            }
            return ArrayNode.fromNodes(newElements);
        } else if (node.isObjectNode()) {
            ObjectNode objNode = node.expectObjectNode();
            ObjectNode.Builder builder = ObjectNode.builder();
            objNode.getMembers().forEach((k, v) -> {
                String keyStr = k.getValue();
                builder.withMember(keyStr, applyReplacements(v, path + "[`" + keyStr + "`]"));
            });
            return builder.build();
        }
        return node;
    }

    private List<Integer> getOrderedVariableIds() {
        List<Integer> orderedVariableIds = new ArrayList<>(variableIdsUsed);
        orderedVariableIds.sort((a, b) -> {
            String boolStartChar = "b";
            String aBlock = varIdToBlock.get(a);
            String bBlock = varIdToBlock.get(b);
            String aStartChar = String.valueOf(aBlock.charAt(0));
            String bStartChar = String.valueOf(bBlock.charAt(0));

            if ("t".equals(aStartChar) || "f".equals(aStartChar)) {
                aStartChar = boolStartChar;
            }
            if ("t".equals(bStartChar) || "f".equals(bStartChar)) {
                bStartChar = boolStartChar;
            }

            if (aStartChar.equals(bStartChar)) {
                return 0;
            }

            for (String startChar : new String[] {"[", "{", "\"", boolStartChar}) {
                if (aStartChar.equals(startChar)) {
                    return 1;
                } else if (bStartChar.equals(startChar)) {
                    return -1;
                }
            }

            throw new RuntimeException("unexpected start char: " + aStartChar + ", " + bStartChar);
        });
        return orderedVariableIds;
    }

    private static String stripWordOnlyKeyQuotes(String json) {
        return WORD_ONLY_KEY.matcher(json).replaceAll("$1:");
    }

    /**
     * Reformats the _data={...}; portion of the buffer to add newlines and indentation
     * for top-level object keys and individual array entries within those keys.
     */
    private static String prettyPrintData(String buffer) {
        int dataStart = buffer.indexOf("const _data=");

        if (dataStart < 0) {
            return buffer;
        }

        int objectLiteralStart = buffer.indexOf('{', dataStart);

        // Find the matching closing brace at depth 0.
        int depth = 0;
        int objectLiteralEnd = -1;

        for (int i = objectLiteralStart; i < buffer.length(); ++i) {
            char c = buffer.charAt(i);
            if (c == '"') {
                // skip string literals
                i += 1;
                while (i < buffer.length() && buffer.charAt(i) != '"') {
                    if (buffer.charAt(i) == '\\') {
                        i += 1;
                    }
                    i += 1;
                }
            } else if (c == '{' || c == '[' || c == '(') {
                depth += 1;
            } else if (c == '}' || c == ']' || c == ')') {
                depth -= 1;
                if (depth == 0) {
                    objectLiteralEnd = i;
                    break;
                }
            }
        }

        if (objectLiteralEnd < 0) {
            return buffer;
        }

        // Extract the content between the outer braces of _data={...}
        String inner = buffer.substring(objectLiteralStart + 1, objectLiteralEnd);
        StringBuilder b = new StringBuilder();
        b.append(buffer, 0, objectLiteralStart);
        b.append("{\n");

        // Parse top-level key:value pairs (depth 0 commas separate them)
        List<String> topEntries = splitAtDepthZero(inner);
        for (int i = 0; i < topEntries.size(); ++i) {
            String entry = topEntries.get(i);
            // Find the colon separating key from value at depth 0
            int colonPos = findDepthZeroColon(entry);
            if (colonPos < 0) {
                // No colon found, just indent it as-is
                b.append("  ").append(entry.trim());
            } else {
                String key = entry.substring(0, colonPos + 1).trim();
                String value = entry.substring(colonPos + 1).trim();
                if (value.startsWith("[")) {
                    // Find matching "]" for this top-level array
                    String arrayContent = value.substring(1, value.length() - 1);
                    List<String> items = splitAtDepthZero(arrayContent);
                    b.append("  ").append(key).append(" [\n");
                    for (int j = 0; j < items.size(); ++j) {
                        b.append("    ").append(items.get(j).trim());
                        if (j < items.size() - 1) {
                            b.append(",");
                        }
                        b.append("\n");
                    }
                    b.append("  ]");
                } else {
                    b.append("  ").append(key).append(" ").append(value);
                }
            }
            if (i < topEntries.size() - 1) {
                b.append(",");
            }
            b.append("\n");
        }

        b.append("}");
        b.append(buffer, objectLiteralEnd + 1, buffer.length());
        return b.toString();
    }

    /**
     * Splits a string by a "," character, but only at bracket depth 0,
     * respecting strings, brackets, and parentheses.
     */
    private static List<String> splitAtDepthZero(String s) {
        List<String> parts = new ArrayList<>();
        int depth = 0;
        int start = 0;
        for (int i = 0; i < s.length(); ++i) {
            char c = s.charAt(i);
            if (c == '"') {
                i += 1;
                while (i < s.length() && s.charAt(i) != '"') {
                    if (s.charAt(i) == '\\') {
                        i += 1;
                    }
                    i += 1;
                }
            } else if (c == '{' || c == '[' || c == '(') {
                depth += 1;
            } else if (c == '}' || c == ']' || c == ')') {
                depth -= 1;
            } else if (c == ',' && depth == 0) {
                parts.add(s.substring(start, i));
                start = i + 1;
            }
        }
        if (start < s.length()) {
            parts.add(s.substring(start));
        }
        return parts;
    }

    /**
     * Finds the position of the first colon at bracket depth 0 in the string,
     * which separates a key from its value in an object entry.
     */
    private static int findDepthZeroColon(String s) {
        int depth = 0;
        for (int i = 0; i < s.length(); ++i) {
            char c = s.charAt(i);
            if (c == '"') {
                i += 1;
                while (i < s.length() && s.charAt(i) != '"') {
                    if (s.charAt(i) == '\\') {
                        i += 1;
                    }
                    i += 1;
                }
            } else if (c == '{' || c == '[' || c == '(') {
                depth += 1;
            } else if (c == '}' || c == ']' || c == ')') {
                depth -= 1;
            } else if (c == ':' && depth == 0) {
                return i;
            }
        }
        return -1;
    }
}
