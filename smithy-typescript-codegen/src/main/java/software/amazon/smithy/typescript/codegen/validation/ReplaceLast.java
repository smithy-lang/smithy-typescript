/*
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
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
