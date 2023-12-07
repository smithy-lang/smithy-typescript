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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.typescript.codegen.validation.ReplaceLast;

public class ExtensionConfigurationGenerator {

    private static final String CLIENT_CONFIGURATION_TEMPLATE = "extensionConfiguration.template";
    private static final String FILENAME = "extensionConfiguration.ts";

    private final Model model;
    private final TypeScriptSettings settings;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final TypeScriptDelegator delegator;
    private final List<TypeScriptIntegration> integrations;

    public ExtensionConfigurationGenerator(
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
        Map<String, Dependency> interfaces = new HashMap<>();

        for (TypeScriptIntegration integration : integrations) {
            integration.getExtensionConfigurationInterfaces(model, settings).forEach(configurationInterface -> {
                interfaces.put(configurationInterface.name().left,
                        configurationInterface.name().right);
            });
        }

        String clientName = ReplaceLast.in(
            ReplaceLast.in(
                symbolProvider.toSymbol(service).getName(),
                "Client", ""
            ),
            "client", ""
        );

        String clientConfigurationContent = TypeScriptUtils
            .loadResourceAsString(CLIENT_CONFIGURATION_TEMPLATE)
            .replace("${extensionConfigName}", clientName + "ExtensionConfiguration")
            .replace("${extensionConfigInterfaces}", String.join(", ", interfaces.keySet()));

        delegator.useFileWriter(Paths.get(CodegenUtils.SOURCE_FOLDER, FILENAME).toString(), writer -> {
            interfaces.entrySet().forEach(entry -> {
                writer.addDependency(entry.getValue());
                writer.addImport(entry.getKey(), null, entry.getValue());
            });
            writer.write(clientConfigurationContent);
        });
    }
}
