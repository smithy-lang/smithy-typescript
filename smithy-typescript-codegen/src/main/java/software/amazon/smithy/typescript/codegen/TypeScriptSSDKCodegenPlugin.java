/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen;

import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Plugin to trigger TypeScript SSDK code generation.
 *
 * @deprecated Use {@link TypeScriptServerCodegenPlugin} instead.
 */
@SmithyInternalApi
@Deprecated
@SuppressWarnings("AbbreviationAsWordInName")
public class TypeScriptSSDKCodegenPlugin extends TypeScriptServerCodegenPlugin {
  @Override
  public String getName() {
    return "typescript-ssdk-codegen";
  }
}
