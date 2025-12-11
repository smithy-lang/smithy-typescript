/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.auth.http.sections;

import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public final class DefaultHttpAuthSchemeProviderFunctionCodeSection implements CodeSection {
    private final ServiceShape service;
    private final TypeScriptSettings settings;
    private final Model model;
    private final SymbolProvider symbolProvider;

    private DefaultHttpAuthSchemeProviderFunctionCodeSection(Builder builder) {
        service = SmithyBuilder.requiredState("service", builder.service);
        settings = SmithyBuilder.requiredState("settings", builder.settings);
        model = SmithyBuilder.requiredState("model", builder.model);
        symbolProvider = SmithyBuilder.requiredState("symbolProvider", builder.symbolProvider);
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

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder implements SmithyBuilder<DefaultHttpAuthSchemeProviderFunctionCodeSection> {
        private ServiceShape service;
        private TypeScriptSettings settings;
        private Model model;
        private SymbolProvider symbolProvider;

        @Override
        public DefaultHttpAuthSchemeProviderFunctionCodeSection build() {
            return new DefaultHttpAuthSchemeProviderFunctionCodeSection(this);
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
    }
}
