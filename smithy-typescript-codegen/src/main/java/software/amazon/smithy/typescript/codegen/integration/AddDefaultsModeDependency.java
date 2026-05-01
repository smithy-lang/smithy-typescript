/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.integration;

import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Adds defaults mode dependencies if needed.
 */
@SmithyInternalApi
public class AddDefaultsModeDependency implements TypeScriptIntegration {

    @Override
    public void addConfigInterfaceFields(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer
    ) {
        // Dependencies used in the default runtime config template.
        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
        writer.addTypeImportSubmodule(
            "DefaultsMode",
            "__DefaultsMode",
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.CLIENT
        );
        writer.addTypeImport("Provider", "__Provider", TypeScriptDependency.SMITHY_TYPES);
        writer.writeDocs(
            "The {@link @smithy/smithy-client#DefaultsMode} that " +
                "will be used to determine how certain default configuration " +
                "options are resolved in the SDK."
        );
        writer.write("defaultsMode?: __DefaultsMode | __Provider<__DefaultsMode>;");
    }
}
