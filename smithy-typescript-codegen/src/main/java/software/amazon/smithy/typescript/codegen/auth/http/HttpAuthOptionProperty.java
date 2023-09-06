/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.util.function.Consumer;
import java.util.function.Function;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Definition of an HttpAuthOptionProperty.
 *
 * @param name name of the auth option property
 * @param type the type of {@link Type}
 * @param source a function that provides the auth trait to a writer, and writes
 *  properties from the trait or from {@code authParameters}.
 */
@SmithyUnstableApi
public final record HttpAuthOptionProperty(
    String name,
    Type type,
    Function<Trait, Consumer<TypeScriptWriter>> source
) {
    /**
     * Defines the type of the auth option property.
     */
    public enum Type {
        /**
         * Specifies the property should be included in {@code identityProperties}.
         */
        IDENTITY,
        /**
         * Specifies the property should be included in {@code signingProperties}.
         */
        SIGNING
    }
}
