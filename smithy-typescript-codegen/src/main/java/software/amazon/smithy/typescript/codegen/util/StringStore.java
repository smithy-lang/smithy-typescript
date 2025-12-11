/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.util;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import java.util.Objects;
import java.util.Queue;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.regex.Pattern;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Intended for use at the
 * {@link software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext}
 * level, this class allocates and tracks variables assigned to string literals, allowing a
 * form of compression on long protocol serde files.
 */
@SmithyInternalApi
public class StringStore {

    /**
     * Words are the component strings found within `camelCaseWords` or `header-dashed-words`.
     */
    private static final Pattern FIND_WORDS = Pattern.compile("(x-amz)|(-\\w{3,})|(^[a-z]{3,})|([A-Z][a-z]{2,})");

    // order doesn't matter for this map.
    private final Map<String, String> literalToVariable = new HashMap<>();

    // this map should be ordered for consistent codegen output.
    private final TreeMap<String, String> variableToLiteral = new TreeMap<>();

    // controls incremental output.
    private final Set<String> writeLog = new HashSet<>();

    public StringStore() {}

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

        for (Map.Entry<String, String> entry : variableToLiteral.entrySet()) {
            String variable = entry.getKey();
            String literal = entry.getValue();
            if (writeLog.add(variable)) {
                sourceCode.append(String.format("const %s = \"%s\";%n", variable, literal));
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

    public WithSchemaWriter useSchemaWriter(TypeScriptWriter writer) {
        return new WithSchemaWriter(writer, this);
    }

    @SmithyInternalApi
    public static final class WithSchemaWriter extends StringStore {

        private final TypeScriptWriter writer;
        private final StringStore store;

        private WithSchemaWriter(TypeScriptWriter writer, StringStore store) {
            this.writer = writer;
            this.store = store;
        }

        @Override
        public String var(String literal) {
            String var = store.var(literal);
            writer.addRelativeImport(var, null, Path.of("./schemas_0"));
            return var;
        }

        @Override
        public String var(String literal, String preferredPrefix) {
            String var = store.var(literal, preferredPrefix);
            writer.addRelativeImport(var, null, Path.of("./schemas_0"));
            return var;
        }
    }
}
