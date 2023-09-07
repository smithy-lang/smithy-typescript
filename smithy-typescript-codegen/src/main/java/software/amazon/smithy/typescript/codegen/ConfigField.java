/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen;

import java.util.function.Consumer;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Definition of a Config field.
 *
 * Currently used to populate the ClientDefaults interface in `experimentalIdentityAndAuth`.
 *
 * @param name name of the config field
 * @param source writer for the type of the config field
 * @param docs writer for the docs of the config field
 */
@SmithyUnstableApi
public final record ConfigField(
    String name,
    Type type,
    Consumer<TypeScriptWriter> source,
    Consumer<TypeScriptWriter> docs
) {
    /**
     * Defines the type of the config field.
     */
    @SmithyUnstableApi
    public enum Type {
        /**
         * Specifies the property is important, e.g. {@code apiKey} for {@code @httpApiKeyAuth}
         */
        MAIN,
        /**
         * Specifies the property is auxiliary, e.g. {@code region} for {@code @aws.auth#sigv4}
         */
        AUXILIARY
    }
}
