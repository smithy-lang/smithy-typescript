/*
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

    private static final String TEMPLATE_1 = "runtimeExtensions1.template";
    private static final String TEMPLATE_2 = "runtimeExtensions2.template";
    private static final String FILENAME = "runtimeExtensions.ts";

    private final Model model;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final TypeScriptDelegator delegator;
    private final List<TypeScriptIntegration> integrations;

    public RuntimeExtensionsGenerator(
        Model model, ServiceShape service,
        SymbolProvider symbolProvider,
        TypeScriptDelegator delegator,
        List<TypeScriptIntegration> integrations
    ) {
        this.model = model;
        this.service = service;
        this.symbolProvider = symbolProvider;
        this.delegator = delegator;
        this.integrations = integrations;
    }

    void generate() {
        String clientName = symbolProvider.toSymbol(service).getName();

        String template1Contents = TypeScriptUtils.loadResourceAsString(TEMPLATE_1)
            .replace("${clientConfigName}", clientName + "Configuration")
            .replace("$", "$$") // sanitize template place holders.
            .replace("$${getPartialClientConfigurations}", "${L@getPartialClientConfigurations}");

        String template2Contents = TypeScriptUtils.loadResourceAsString(TEMPLATE_2)
            .replace("$", "$$") // sanitize template place holders.
            .replace("$${resolvePartialRuntimeConfigs}", "${L@resolvePartialRuntimeConfigs}");

        delegator.useFileWriter(Paths.get(CodegenUtils.SOURCE_FOLDER, FILENAME).toString(), writer -> {
            for (TypeScriptIntegration integration : integrations) {
                integration.getClientConfigurationInterfaces().forEach(configurationInterface -> {
                    writer.addDependency(configurationInterface.dependency());
                    writer.addImport(configurationInterface.getClientConfigurationFn(), null,
                            configurationInterface.dependency());
                    writer.addImport(configurationInterface.resolveRuntimeConfigFn(), null,
                            configurationInterface.dependency());
                });
            }

            writer.indent().onSection("getPartialClientConfigurations", original -> {
                for (TypeScriptIntegration integration : integrations) {
                    integration.getClientConfigurationInterfaces().forEach(configurationInterface -> {
                        writer.indent(2).write("...asPartial($L(runtimeConfig)),",
                                configurationInterface.getClientConfigurationFn());
                        writer.dedent(2);
                    });
                }
            });
            writer.dedent().write(template1Contents, "");

            writer.indent().onSection("resolvePartialRuntimeConfigs", original -> {
                for (TypeScriptIntegration integration : integrations) {
                    integration.getClientConfigurationInterfaces().forEach(configurationInterface -> {
                        writer.indent(2).write("...$L(clientConfiguration),",
                                configurationInterface.resolveRuntimeConfigFn());
                        writer.dedent(2);
                    });
                }
            });
            writer.dedent().write(template2Contents, "");
        });
    }
}
