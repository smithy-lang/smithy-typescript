/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.util;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import java.util.Objects;
import java.util.Queue;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Intended for use at the
 * {@link software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext}
 * level, this class allocates and tracks variables assigned to string literals, allowing a
 * form of compression on long protocol serde files.
 */
@SmithyInternalApi
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
        Objects.requireNonNull(literal);
        return literalToVariable.computeIfAbsent(literal, this::assignKey);
    }

    /**
     * Outputs the generated code for any constants that have been
     * allocated but not yet retrieved.
     */
    public String flushVariableDeclarationCode() {
        StringBuilder sourceCode = new StringBuilder();

        for (Map.Entry<String, String> entry : variableToLiteral.entrySet()) {
            String v = entry.getKey();
            String l = entry.getValue();
            if (writelog.add(v)) {
                sourceCode.append(String.format("const %s = \"%s\";%n", v, l));
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
     * Assigns a unique variable using the letters from the literal.
     * Prefers the uppercase or word-starting letters.
     */
    private String allocateVariable(String literal) {
        String[] sections = literal.split("[-_\\s]");
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
