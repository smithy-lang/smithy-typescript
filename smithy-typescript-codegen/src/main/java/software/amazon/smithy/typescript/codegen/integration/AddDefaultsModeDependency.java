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

package software.amazon.smithy.typescript.codegen.integration;

import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyInternalApi;

/** Adds defaults mode dependencies if needed. */
@SmithyInternalApi
public class AddDefaultsModeDependency implements TypeScriptIntegration {
  @Override
  public void addConfigInterfaceFields(
      TypeScriptSettings settings,
      Model model,
      SymbolProvider symbolProvider,
      TypeScriptWriter writer) {
    // Dependencies used in the default runtime config template.
    writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_DEFAULTS_MODE_BROWSER);
    writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_DEFAULTS_MODE_NODE);
    writer.addTypeImport("DefaultsMode", "__DefaultsMode", TypeScriptDependency.AWS_SMITHY_CLIENT);
    writer.addTypeImport("Provider", "__Provider", TypeScriptDependency.SMITHY_TYPES);
    writer.writeDocs(
        "The {@link @smithy/smithy-client#DefaultsMode} that "
            + "will be used to determine how certain default configuration "
            + "options are resolved in the SDK.");
    writer.write("defaultsMode?: __DefaultsMode | __Provider<__DefaultsMode>;");
  }
}
