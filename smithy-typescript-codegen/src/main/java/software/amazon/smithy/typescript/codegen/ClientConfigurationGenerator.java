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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

public class ClientConfigurationGenerator {

    private static final String CLIENT_CONFIGURATION_TEMPLATE = "clientConfiguration.template";
    private static final String FILENAME = "clientConfiguration.ts";

    private final Model model;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final TypeScriptDelegator delegator;
    private final List<TypeScriptIntegration> integrations;

    public ClientConfigurationGenerator(
        Model model,
        ServiceShape service,
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
        Map<String, Dependency> interfaces = new HashMap<>();

        for (TypeScriptIntegration integration : integrations) {
            integration.getClientConfigurationInterfaces().forEach(configurationInterface -> {
                interfaces.put(configurationInterface.name(),
                        configurationInterface.dependency());
            });
        }

        String clientName = symbolProvider.toSymbol(service).getName();

        String clientConfigurationContent = TypeScriptUtils
            .loadResourceAsString(CLIENT_CONFIGURATION_TEMPLATE)
            .replace("${clientConfigName}", clientName + "Configuration")
            .replace("${clientConfigInterfaces}", String.join(", ", interfaces.keySet()));

        delegator.useFileWriter(Paths.get(CodegenUtils.SOURCE_FOLDER, FILENAME).toString(), writer -> {
            interfaces.entrySet().forEach(entry -> {
                writer.addDependency(entry.getValue());
                writer.addImport(entry.getKey(), null, entry.getValue());
            });
            writer.write(clientConfigurationContent);
        });
    }
}
