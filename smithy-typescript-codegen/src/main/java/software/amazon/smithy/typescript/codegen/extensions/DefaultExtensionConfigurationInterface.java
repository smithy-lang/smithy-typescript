/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.extensions;

import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.utils.Pair;

public class DefaultExtensionConfigurationInterface implements ExtensionConfigurationInterface {

  @Override
  public Pair<String, Dependency> name() {
    return Pair.of("DefaultExtensionConfiguration", TypeScriptDependency.SMITHY_TYPES);
  }

  @Override
  public Pair<String, Dependency> getExtensionConfigurationFn() {
    return Pair.of("getDefaultExtensionConfiguration", TypeScriptDependency.AWS_SMITHY_CLIENT);
  }

  @Override
  public Pair<String, Dependency> resolveRuntimeConfigFn() {
    return Pair.of("resolveDefaultRuntimeConfig", TypeScriptDependency.AWS_SMITHY_CLIENT);
  }
}
