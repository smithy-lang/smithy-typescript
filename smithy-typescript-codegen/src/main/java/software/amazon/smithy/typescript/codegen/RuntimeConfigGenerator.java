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

import java.util.List;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

/**
 * Generates runtime configuration files, files that are used to
 * supply different default values based on the targeted language
 * environment of the SDK (e.g., Node vs Browser).
 */
final class RuntimeConfigGenerator {

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final String protocolName;
    private final TypeScriptDelegator delegator;
    private final List<TypeScriptIntegration> integrations;

    RuntimeConfigGenerator(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            String protocolName,
            TypeScriptDelegator delegator,
            List<TypeScriptIntegration> integrations
    ) {
        this.settings = settings;
        this.model = model;
        this.service = settings.getService(model);
        this.symbolProvider = symbolProvider;
        this.protocolName = protocolName;
        this.delegator = delegator;
        this.integrations = integrations;
    }

    void generate(LanguageTarget target) {
        String template = TypeScriptUtils.loadResourceAsString(target.getTemplateFileName());
        String contents = template
                .replace("${clientModuleName}", symbolProvider.toSymbol(service).getNamespace())
                // Set the protocol to "undefined" if no default protocol can be resolved.
                // This should only be the case when testing out code generators. The runtime
                // code is expected to throw an exception when this value is encountered.
                .replace("${protocol}", protocolName == null ? "undefined" : protocolName)
                .replace("$", "$$") // sanitize template place holders.
                .replace("$${customizations}", "${L@customizations}");

        delegator.useFileWriter(target.getTargetFilename(), writer -> {
            // Inject customizations into the ~template.
            writer.onSection("customizations", original -> {
                writer.indent();
                for (TypeScriptIntegration integration : integrations) {
                    integration.addRuntimeConfigValues(settings, model, symbolProvider, writer, target);
                }
                writer.dedent();
            });
            writer.write(contents, "");
        });
    }
}
