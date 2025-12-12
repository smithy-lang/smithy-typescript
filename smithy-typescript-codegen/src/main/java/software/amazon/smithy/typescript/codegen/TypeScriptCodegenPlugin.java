/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Plugin to trigger TypeScript code generation.
 * @deprecated Use {@link TypeScriptClientCodegenPlugin} instead.
 */
@SmithyInternalApi
@Deprecated
public final class TypeScriptCodegenPlugin extends TypeScriptClientCodegenPlugin {

    @Override
    public String getName() {
        return "typescript-codegen";
    }
}
