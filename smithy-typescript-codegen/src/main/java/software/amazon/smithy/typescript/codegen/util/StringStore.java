/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.util;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Queue;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.regex.MatchResult;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Intended for use at the
 * {@link software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext}
 * level, this class allocates and tracks variables assigned to string literals, allowing a
 * form of compression on long protocol serde files.
 */
@SmithyInternalApi
public final class StringStore {
    /**
     * Words are the component strings found within `camelCaseWords` or `header-dashed-words`.
     */
    private static final Pattern FIND_WORDS = Pattern.compile("(x-amz)|(-\\w{3,})|(^[a-z]{3,})|([A-Z][a-z]{2,})");

    // order doesn't matter for this map.
    private final Map<String, String> literalToVariable = new HashMap<>();

    // this map should be ordered for consistent codegen output.
    private final TreeMap<String, String> variableToLiteral = new TreeMap<>();

    // controls incremental output.
    private final Set<String> writelog = new HashSet<>();

    private final WordTrie wordTrie = new WordTrie();

    private boolean useCompounds = false;

    public StringStore() {}

    public StringStore(boolean useCompounds) {
        this.useCompounds = useCompounds;
    }

    /**
     * @param literal - a literal string value.
     * @return the variable name assigned for that string, which may have been encountered before.
     */
    public String var(String literal) {
        Objects.requireNonNull(literal);
        return literalToVariable.computeIfAbsent(literal, this::assignKey);
    }

    /**
     * @param literal - a literal string value.
     * @param preferredPrefix - a preferred rather than derived variable name.
     * @return allocates the variable with the preferred prefix.
     */
    public String var(String literal, String preferredPrefix) {
        Objects.requireNonNull(literal);
        return literalToVariable.computeIfAbsent(literal, (String key) -> assignPreferredKey(key, preferredPrefix));
    }

    /**
     * @param literal - query.
     * @return whether the literal has already been assigned.
     */
    public boolean hasVar(String literal) {
        return literalToVariable.containsKey(literal);
    }

    /**
     * Outputs the generated code for any constants that have been
     * allocated but not yet retrieved.
     */
    public String flushVariableDeclarationCode() {
        StringBuilder sourceCode = new StringBuilder();

        if (useCompounds) {
// word to count.
            Map<String, Integer> wordCount = new HashMap<>();
            // whether to use concatenation to write the variable's value.
            Set<String> writeLiteralUsingStoredWords = new HashSet<>();
            Map<String, List<String>> literalToWords = new HashMap<>();

            Set<Map.Entry<String, String>> variableToLiteralEntries = variableToLiteral.entrySet();
            List<String> writeWords = new ArrayList<>();
            List<String> writeCompounds = new ArrayList<>();
            List<String> writeStrings = new ArrayList<>();

            // get word count.
            for (Map.Entry<String, String> entry : variableToLiteralEntries) {
                String literal = entry.getValue();
                List<String> words = FIND_WORDS.matcher(literal)
                    .results()
                    .map(MatchResult::group)
                    .toList();
                literalToWords.put(literal, words);
                wordTrie.recordWords(words);
                boolean wordsContiguousInLiteral = literal.contains(String.join("", words));
                for (String word : words) {
                    if (wordsContiguousInLiteral) {
                        wordCount.compute(word, (k, v) -> v == null ? 1 : v + 1);
                    }
                }
            }
            // determine which literals to write using words.
            for (Map.Entry<String, String> entry : variableToLiteralEntries) {
                String literal = entry.getValue();
                String[] words = literalToWords.get(literal).toArray(new String[0]);
                boolean wordsContiguousInLiteral = literal.contains(String.join("", words));
                if (wordsContiguousInLiteral) {
                    writeLiteralUsingStoredWords.add(literal);
                }
            }
            // write words.
            for (Map.Entry<String, Integer> entry : wordCount.entrySet()) {
                String word = entry.getKey();
                String variable = var(word);
                if (writelog.add(variable)) {
                    writeWords.add(String.format("const %s = \"%s\";%n", variable, word));
                }
            }

            int compoundOrder = 0;
            Map<String, String> compoundVars = new HashMap<>();

            // write stored strings.
            for (Map.Entry<String, String> entry : variableToLiteral.entrySet()) {
                String variable = entry.getKey();
                String literal = entry.getValue();
                if (writelog.add(variable)) {
                    String[] words = literalToWords.get(literal).toArray(new String[0]);
                    int compoundIndex = wordTrie.bestIndex(literalToWords.get(literal));
                    boolean useCompoundExpression = compoundIndex >= 2;
                    String compoundVar = null;

                    if (useCompoundExpression) {
                        List<String> prefix = literalToWords.get(literal).subList(0, compoundIndex);
                        String compoundConcatInCode = prefix
                            .stream()
                            .map(literalToVariable::get)
                            .collect(Collectors.joining("+"));
                        if (!compoundVars.containsKey(compoundConcatInCode)) {
                            compoundVars.put(compoundConcatInCode, "_c" + compoundOrder);
                            compoundOrder += 1;
                            writeCompounds.add("""
                        const %s = %s;%n
                        """.formatted(compoundVars.get(compoundConcatInCode), compoundConcatInCode));
                        }
                        compoundVar = compoundVars.get(compoundConcatInCode);
                    }

                    if (writeLiteralUsingStoredWords.contains(literal)) {
                        String wordsConcat = String.join("", words);
                        List<String> segments = Arrays.stream(literal.split(wordsConcat))
                            .filter(s -> !s.isEmpty())
                            .toList();

                        if (segments.size() <= 2) {
                            String wordsConcatInCode = Arrays.stream(words)
                                .map(literalToVariable::get)
                                .collect(Collectors.joining("+"));
                            if (useCompoundExpression && compoundVar != null) {
                                List<String> wordsList = literalToWords.get(literal);
                                String nonCompoundSuffix = wordsList
                                    .subList(compoundIndex, wordsList.size())
                                    .stream()
                                    .map(literalToVariable::get)
                                    .collect(Collectors.joining("+"));
                                if (nonCompoundSuffix.isEmpty()) {
                                    wordsConcatInCode = compoundVar;
                                } else {
                                    wordsConcatInCode = compoundVar + "+" + nonCompoundSuffix;
                                }
                            }

                            String concatenationExpression;
                            if (segments.isEmpty() || literal.equals(wordsConcat)) {
                                concatenationExpression = wordsConcatInCode;
                            } else if (segments.size() == 1) {
                                if (literal.startsWith(wordsConcat)) {
                                    concatenationExpression = """
                                %s + "%s\"""".formatted(wordsConcatInCode, segments.get(0));
                                } else {
                                    concatenationExpression = """
                                "%s" + %s""".formatted(segments.get(0), wordsConcatInCode);
                                }
                            } else /*2*/ {
                                concatenationExpression = """
                                "%s" + %s + "%s\"""".formatted(segments.get(0), wordsConcatInCode, segments.get(1));
                            }

                            writeStrings.add(String.format(
                                "const %s = %s as %s;%n", variable, concatenationExpression, "\"" + literal + "\""));
                        } else {
                            writeStrings.add(String.format("const %s = \"%s\";%n", variable, literal));
                        }
                    } else {
                        writeStrings.add(String.format("const %s = \"%s\";%n", variable, literal));
                    }
                }
            }

            writeWords.forEach(sourceCode::append);
            writeCompounds.forEach(sourceCode::append);
            writeStrings.forEach(sourceCode::append);
        } else {
            for (Map.Entry<String, String> entry : variableToLiteral.entrySet()) {
                String variable = entry.getKey();
                String literal = entry.getValue();
                if (writelog.add(variable)) {
                    sourceCode.append(String.format("const %s = \"%s\";%n", variable, literal));
                }
            }
        }
        return sourceCode.toString();
    }

    /**
     * Assigns a new variable for a given string literal.
     * Avoid calling assignKey more than once for a given literal, for example with
     * {@link HashMap#computeIfAbsent(Object, Function)}, since it would
     * allocate two different variables.
     */
    private String assignKey(String literal) {
        String variable = allocateVariable(literal);
        variableToLiteral.put(variable, literal);
        return variable;
    }

    /**
     * Allocates a variable name for a given string literal.
     */
    private String assignPreferredKey(String literal, String preferredPrefix) {
        int numericSuffix = 0;
        String candidate = preferredPrefix + numericSuffix;
        while (variableToLiteral.containsKey(candidate)) {
            numericSuffix += 1;
            candidate = preferredPrefix + numericSuffix;
        }
        variableToLiteral.put(candidate, literal);
        return candidate;
    }

    /**
     * Assigns a unique variable using the letters from the literal.
     * Prefers the uppercase or word-starting letters.
     */
    private String allocateVariable(String literal) {
        String[] sections = Arrays.stream(literal.split("[-_\\s]"))
            .filter(s -> !s.isEmpty())
            .toArray(String[]::new);
        StringBuilder v = new StringBuilder("_");
        Queue<Character> deconfliction = new LinkedList<>();
        if (sections.length > 1) {
            for (String s : sections) {
                char c = s.charAt(0);
                if (isAllowedChar(c)) {
                    v.append(c);
                }
            }
        } else {
            for (int i = 0; i < literal.length(); i++) {
                char c = literal.charAt(i);
                if ((c >= 'A' && c <= 'Z') || (isNeutral(v.toString()) && isAllowedChar(c))) {
                    v.append(c);
                } else if (isAllowedChar(c)) {
                    deconfliction.add(c);
                }
            }
        }
        if (v.isEmpty()) {
            v.append("v");
        }
        while (variableToLiteral.containsKey(v.toString())) {
            if (!deconfliction.isEmpty()) {
                v.append(deconfliction.poll());
            } else {
                v.append('_');
            }
        }
        return v.toString();
    }

    /**
     * @return true if char is in A-Za-z.
     */
    private boolean isAllowedChar(char c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    }

    /**
     * @return true if the variable has only underscores.
     */
    private boolean isNeutral(String variable) {
        for (int i = 0; i < variable.length(); i++) {
            if (variable.charAt(i) != '_') {
                return false;
            }
        }
        return true;
    }
}
