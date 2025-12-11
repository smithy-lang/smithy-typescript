/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.validation;

public abstract class ReplaceLast {

    /**
     * @param original - source string.
     * @param target - substring to be replaced.
     * @param replacement - the replacement.
     * @return original with the last occurrence of the target string replaced by the replacement string.
     */
    public static String in(String original, String target, String replacement) {
        int lastPosition = original.lastIndexOf(target);
        if (lastPosition >= 0) {
            return original.substring(0, lastPosition)
                    + replacement
                    + original.substring(lastPosition + target.length());
        }
        return original;
    }
}
