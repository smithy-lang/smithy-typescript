/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.validation;

/**
 * For handling expressions that may be unary function calls.
 */
public abstract class UnaryFunctionCall {
    /**
     * @param expression - to be examined.
     * @return whether the expression is a single-depth function call with a single parameter.
     */
    public static boolean check(String expression) {
        if (expression.equals("_")) {
            // not a call per se, but this indicates a pass-through function.
            return true;
        }
        return maxCallDepth(expression) == 1
            && expression.matches(".+\\(.*\\)$")
            && !expression.contains("new ")
            && !expression.contains(",");
    }

    /**
     * @param callExpression - the call expression to be converted. Check that
     *                         the expression is a unary call first.
     * @return the unary function call converted to a function reference.
     */
    public static String toRef(String callExpression) {
        return callExpression.replaceAll("(.*)\\(.*\\)$", "$1");
    }

    /**
     * Estimates the call depth of a function call expression.
     *
     * @example
     * call() == 1
     * call(call()) == 2
     */
    private static int maxCallDepth(String expression) {
        int depth = 0;
        int maxDepth = 0;
        for (int i = 0; i < expression.length(); ++i) {
            char c = expression.charAt(i);
            if (c == '(') {
                depth += 1;
                if (depth > maxDepth) {
                    maxDepth = depth;
                }
                continue;
            }
            if (c == ')') {
                depth -= 1;
            }
        }
        return maxDepth;
    }
}
