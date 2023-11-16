/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import java.nio.file.Paths;
import java.util.List;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

public class RuntimeExtensionsGenerator {

    private static final String TEMPLATE_1 = "resolveRuntimeExtensions1.template";
    private static final String TEMPLATE_2 = "resolveRuntimeExtensions2.template";
    private static final String FILENAME = "runtimeExtensions.ts";

    private final Model model;
    private final TypeScriptSettings settings;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final TypeScriptDelegator delegator;
    private final List<TypeScriptIntegration> integrations;

    public RuntimeExtensionsGenerator(
        Model model,
        TypeScriptSettings settings,
        ServiceShape service,
        SymbolProvider symbolProvider,
        TypeScriptDelegator delegator,
        List<TypeScriptIntegration> integrations
    ) {
        this.model = model;
        this.settings = settings;
        this.service = service;
        this.symbolProvider = symbolProvider;
        this.delegator = delegator;
        this.integrations = integrations;
    }

    void generate() {
        String clientName = symbolProvider.toSymbol(service).getName()
                .replace("Client", "")
                .replace("client", "");

        String template1Contents = TypeScriptUtils.loadResourceAsString(TEMPLATE_1)
            .replace("${extensionConfigName}", clientName + "ExtensionConfiguration")
            .replace("$", "$$") // sanitize template place holders.
            .replace("$${getPartialExtensionConfigurations}", "${L@getPartialExtensionConfigurations}");

        String template2Contents = TypeScriptUtils.loadResourceAsString(TEMPLATE_2)
            .replace("$", "$$") // sanitize template place holders.
            .replace("$${resolvePartialRuntimeConfigs}", "${L@resolvePartialRuntimeConfigs}");

        delegator.useFileWriter(Paths.get(CodegenUtils.SOURCE_FOLDER, FILENAME).toString(), writer -> {
            for (TypeScriptIntegration integration : integrations) {
                integration.getExtensionConfigurationInterfaces(model, settings).forEach(configurationInterface -> {
                    writer.addDependency(configurationInterface.getExtensionConfigurationFn().right);
                    writer.addDependency(configurationInterface.resolveRuntimeConfigFn().right);

                    writer.addImport(configurationInterface.getExtensionConfigurationFn().left, null,
                            configurationInterface.getExtensionConfigurationFn().right);
                    writer.addImport(configurationInterface.resolveRuntimeConfigFn().left, null,
                            configurationInterface.resolveRuntimeConfigFn().right);
                });
            }

            writer.indent().onSection("getPartialExtensionConfigurations", original -> {
                for (TypeScriptIntegration integration : integrations) {
                    integration.getExtensionConfigurationInterfaces(model, settings).forEach(configurationInterface -> {
                        writer.indent(2).write("...asPartial($L(runtimeConfig)),",
                                configurationInterface.getExtensionConfigurationFn().left);
                        writer.dedent(2);
                    });
                }
            });
            writer.dedent().write(template1Contents, "");

            writer.indent().onSection("resolvePartialRuntimeConfigs", original -> {
                for (TypeScriptIntegration integration : integrations) {
                    integration.getExtensionConfigurationInterfaces(model, settings).forEach(configurationInterface -> {
                        writer.indent(2).write("...$L(extensionConfiguration),",
                                configurationInterface.resolveRuntimeConfigFn().left);
                        writer.dedent(2);
                    });
                }
            });
            writer.dedent().write(template2Contents, "");
        });
    }
}
