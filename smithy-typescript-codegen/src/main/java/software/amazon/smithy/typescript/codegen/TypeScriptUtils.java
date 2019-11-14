/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

package software.amazon.smithy.typescript.codegen;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Collection;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import software.amazon.smithy.utils.IoUtils;
import software.amazon.smithy.utils.StringUtils;

/**
 * Utility methods for TypeScript / JavaScript.
 */
final class TypeScriptUtils {

    private static final Pattern PROPERTY_NAME_REGEX = Pattern.compile("^(?![0-9])[a-zA-Z0-9$_]+$");

    private TypeScriptUtils() {}

    /**
     * Adds quotes to the given string if quotes are needed to make it a
     * valid JavaScript property name.
     *
     * @param memberName Member name to check.
     * @return Returns the sanitized member name.
     */
    static String sanitizePropertyName(String memberName) {
        return isValidPropertyName(memberName)
               ? memberName
               : StringUtils.escapeJavaString(memberName, "");
    }

    /**
     * Checks if the given string is a valid JavaScript property name.
     *
     * <p>This check is pretty simplistic, and the rules around property names
     * are much more complex than this according to ECMA-262, but the primary
     * purpose of this method is to make the generated code syntactically
     * valid.
     *
     * @param value Value to check.
     * @return Returns true if the value is ok to be an unquoted property.
     */
    private static boolean isValidPropertyName(String value) {
        return PROPERTY_NAME_REGEX.matcher(value).matches();
    }

    /**
     * Creates a list of sorted, pipe separated enum variants as a union.
     *
     * <p>For example, `"foo" | "baz" | string`. Note: special characters
     * and quotes are escaped as needed.
     *
     * @param values Values to create into a union.
     * @return Returns the union of string literals.
     */
    static String getEnumVariants(Collection<String> values) {
        return values.stream()
                .sorted()
                .map(value -> StringUtils.escapeJavaString(value, ""))
                .collect(Collectors.joining(" | "));
    }

    /**
     * Loads the contents of a resource into a string.
     *
     * @param name Relative path of the resource to load.
     * @return Returns the loaded contents.
     * TODO: this should be a shared feature in smithy-utils
     */
    static String loadResourceAsString(String name) {
        try (InputStream is = TypeScriptUtils.class.getResourceAsStream(name)) {
            return IoUtils.toUtf8String(is);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
