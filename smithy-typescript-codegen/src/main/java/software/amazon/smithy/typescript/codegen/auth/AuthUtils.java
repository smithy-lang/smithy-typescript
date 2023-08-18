/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth;

import java.util.function.Consumer;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Auth utility methods needed across Java packages.
 */
@SmithyInternalApi
public final class AuthUtils {
    /**
     * Writes out `never`, which will make TypeScript compilation fail if used as a value.
     */
    public static final Consumer<TypeScriptWriter> DEFAULT_NEVER_WRITER = w -> w.write("never");

    /**
     * Should be replaced when the synthetic NoAuthTrait is released in Smithy.
     */
    public static final ShapeId NO_AUTH_ID = ShapeId.from("smithy.api#noAuth");

    private AuthUtils() {}
}
