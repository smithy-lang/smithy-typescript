/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.sections;

import java.util.List;
import java.util.Optional;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyUnstableApi;

@SmithyUnstableApi
public final class CommandPropertiesCodeSection implements CodeSection {
    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final OperationShape operation;
    private final SymbolProvider symbolProvider;
    private final List<RuntimeClientPlugin> runtimeClientPlugins;
    private final ProtocolGenerator protocolGenerator;
    private final ApplicationProtocol applicationProtocol;

    private CommandPropertiesCodeSection(Builder builder) {
        settings = SmithyBuilder.requiredState("settings", builder.settings);
        model = SmithyBuilder.requiredState("model", builder.model);
        service = SmithyBuilder.requiredState("service", builder.service);
        operation = SmithyBuilder.requiredState("operation", builder.operation);
        symbolProvider = SmithyBuilder.requiredState("symbolProvider", builder.symbolProvider);
        runtimeClientPlugins = SmithyBuilder.requiredState("runtimeClientPlugins", builder.runtimeClientPlugins);
        protocolGenerator = builder.protocolGenerator;
        applicationProtocol = SmithyBuilder.requiredState("applicationProtocol", builder.applicationProtocol);
    }

    public static Builder builder() {
        return new Builder();
    }

    public TypeScriptSettings getSettings() {
        return settings;
    }

    public Model getModel() {
        return model;
    }

    public ServiceShape getService() {
        return service;
    }

    public OperationShape getOperation() {
        return operation;
    }

    public SymbolProvider getSymbolProvider() {
        return symbolProvider;
    }

    public List<RuntimeClientPlugin> getRuntimeClientPlugins() {
        return runtimeClientPlugins;
    }

    public Optional<ProtocolGenerator> getProtocolGenerator() {
        return Optional.ofNullable(protocolGenerator);
    }

    public ApplicationProtocol getApplicationProtocol() {
        return applicationProtocol;
    }

    public static class Builder implements SmithyBuilder<CommandPropertiesCodeSection> {
        private TypeScriptSettings settings;
        private Model model;
        private ServiceShape service;
        private OperationShape operation;
        private SymbolProvider symbolProvider;
        private List<RuntimeClientPlugin> runtimeClientPlugins;
        private ProtocolGenerator protocolGenerator;
        private ApplicationProtocol applicationProtocol;

        @Override
        public CommandPropertiesCodeSection build() {
            return new CommandPropertiesCodeSection(this);
        }

        public Builder settings(TypeScriptSettings settings) {
            this.settings = settings;
            return this;
        }

        public Builder model(Model model) {
            this.model = model;
            return this;
        }

        public Builder service(ServiceShape service) {
            this.service = service;
            return this;
        }

        public Builder operation(OperationShape operation) {
            this.operation = operation;
            return this;
        }

        public Builder symbolProvider(SymbolProvider symbolProvider) {
            this.symbolProvider = symbolProvider;
            return this;
        }

        public Builder runtimeClientPlugins(List<RuntimeClientPlugin> runtimeClientPlugins) {
            this.runtimeClientPlugins = runtimeClientPlugins;
            return this;
        }

        public Builder protocolGenerator(ProtocolGenerator protocolGenerator) {
            this.protocolGenerator = protocolGenerator;
            return this;
        }

        public Builder applicationProtocol(ApplicationProtocol applicationProtocol) {
            this.applicationProtocol = applicationProtocol;
            return this;
        }
    }
}
