/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.sections;

import java.util.List;
import java.util.Map;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.ConfigField;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public final class ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection implements CodeSection {
    private final ServiceShape service;
    private final TypeScriptSettings settings;
    private final Model model;
    private final SymbolProvider symbolProvider;
    private final List<TypeScriptIntegration> integrations;
    private final Map<String, ConfigField> configFields;

    private ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection(Builder builder) {
        service = SmithyBuilder.requiredState("service", builder.service);
        settings = SmithyBuilder.requiredState("settings", builder.settings);
        model = SmithyBuilder.requiredState("model", builder.model);
        symbolProvider = SmithyBuilder.requiredState("symbolProvider", builder.symbolProvider);
        integrations = SmithyBuilder.requiredState("integrations", builder.integrations);
        configFields = SmithyBuilder.requiredState("configFields", builder.configFields);
    }

    public ServiceShape getService() {
        return service;
    }

    public TypeScriptSettings getSettings() {
        return settings;
    }

    public Model getModel() {
        return model;
    }

    public SymbolProvider getSymbolProvider() {
        return symbolProvider;
    }

    public List<TypeScriptIntegration> getIntegrations() {
        return integrations;
    }

    public Map<String, ConfigField> getConfigFields() {
        return configFields;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder implements SmithyBuilder<ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection> {
        private ServiceShape service;
        private TypeScriptSettings settings;
        private Model model;
        private SymbolProvider symbolProvider;
        private List<TypeScriptIntegration> integrations;
        private Map<String, ConfigField>  configFields;

        @Override
        public ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection build() {
            return new ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection(this);
        }

        public Builder service(ServiceShape service) {
            this.service = service;
            return this;
        }

        public Builder settings(TypeScriptSettings settings) {
            this.settings = settings;
            return this;
        }

        public Builder model(Model model) {
            this.model = model;
            return this;
        }

        public Builder symbolProvider(SymbolProvider symbolProvider) {
            this.symbolProvider = symbolProvider;
            return this;
        }

        public Builder integrations(List<TypeScriptIntegration> integrations) {
            this.integrations = integrations;
            return this;
        }

        public Builder configFields(Map<String, ConfigField> configFields) {
            this.configFields = configFields;
            return this;
        }
    }
}
