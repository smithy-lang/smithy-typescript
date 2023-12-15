/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.util;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.TreeMap;

/**
 * Intended for use at the
 * {@link software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext}
 * level, this class allocates and tracks variables assigned to string literals, allowing a
 * form of compression on long protocol serde files.
 */
public class StringStore {
    // order doesn't matter for this map.
    private final Map<String, String> literalToVariable = new HashMap<>();

    // this map should be ordered for consistent codegen output.
    private final TreeMap<String, String> variableToLiteral = new TreeMap<>();

    // controls incremental output.
    private final Set<String> writelog = new HashSet<>();

    /**
     * @param literal - a literal string value.
     * @return the variable name assigned for that string, which may have been encountered before.
     */
    public String var(String literal) {
        if (literal == null) {
            throw new RuntimeException("Literal must not be null.");
        }
        if (literalToVariable.containsKey(literal)) {
            return literalToVariable.get(literal);
        }
        literalToVariable.put(literal, this.assignKey(literal));
        return literalToVariable.get(literal);
    }

    /**
     * Outputs the generated code for any constants that have been
     * allocated but not yet retrieved.
     */
    public String getIncremental() {
        StringBuilder sourceCode = new StringBuilder();
        Set<String> incrementalKeys = new HashSet<>();

        for (Map.Entry<String, String> entry : variableToLiteral.entrySet()) {
            String v = entry.getKey();
            String l = entry.getValue();
            if (writelog.contains(v)) {
                // sourceCode.append(String.format("// const %s = \"%s\";%n", v, l));
            } else {
                incrementalKeys.add(v);
                sourceCode.append(String.format("const %s = \"%s\";%n", v, l));
            }
        }

        writelog.addAll(incrementalKeys);

        return sourceCode.toString();
    }

    /**
     * Assigns a new variable or returns the existing variable for a given string literal.
     */
    private String assignKey(String literal) {
        if (literalToVariable.containsKey(literal)) {
            return literalToVariable.get(literal);
        }
        String variable = allocateVariable(literal);
        variableToLiteral.put(variable, literal);
        literalToVariable.put(literal, variable);
        return variable;
    }

    /**
     * Assigns a unique variable using the letters from the literal.
     * Prefers the uppercase or word-starting letters.
     */
    private String allocateVariable(String literal) {
        String[] sections = literal.split("[-_\\s]");
        StringBuilder v = new StringBuilder("_");
        Queue<Character> deconfliction = new LinkedList<>();
        if (sections.length > 1) {
            Arrays.stream(sections)
                .map(s -> s.charAt(0))
                .filter(this::isAllowedChar)
                .forEach(v::append);
        } else {
            for (int i = 0; i < literal.length(); ++i) {
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
     * char is in A-Za-z.
     */
    private boolean isAllowedChar(char c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    }

    /**
     * @return true if the variable has only underscores.
     */
    private boolean isNeutral(String variable) {
        return variable.chars().allMatch(c -> c == '_');
    }
}
