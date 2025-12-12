/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.util.ArrayList;
import java.util.List;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.CodegenContext;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Holds context related to code generation.
 */
@SmithyUnstableApi
public final class TypeScriptCodegenContext
    implements CodegenContext<TypeScriptSettings, TypeScriptWriter, TypeScriptIntegration> {

    private final Model model;
    private final TypeScriptSettings settings;
    private final SymbolProvider symbolProvider;
    private final FileManifest fileManifest;
    private final TypeScriptDelegator writerDelegator;
    private final List<TypeScriptIntegration> integrations;
    private final List<RuntimeClientPlugin> runtimePlugins;
    private final ProtocolGenerator protocolGenerator;
    private final ApplicationProtocol applicationProtocol;

    private TypeScriptCodegenContext(Builder builder) {
        model = SmithyBuilder.requiredState("model", builder.model);
        settings = SmithyBuilder.requiredState("settings", builder.settings);
        symbolProvider = SmithyBuilder.requiredState("symbolProvider", builder.symbolProvider);
        fileManifest = SmithyBuilder.requiredState("fileManifest", builder.fileManifest);
        writerDelegator = SmithyBuilder.requiredState("writerDelegator", builder.writerDelegator);
        integrations = SmithyBuilder.requiredState("integrations", builder.integrations);
        runtimePlugins = SmithyBuilder.requiredState("runtimePlugins", builder.runtimePlugins);
        protocolGenerator = builder.protocolGenerator;
        applicationProtocol = SmithyBuilder.requiredState("applicationProtocol", builder.applicationProtocol);
    }

    @Override
    public Model model() {
        return model;
    }

    @Override
    public TypeScriptSettings settings() {
        return settings;
    }

    @Override
    public SymbolProvider symbolProvider() {
        return symbolProvider;
    }

    @Override
    public FileManifest fileManifest() {
        return fileManifest;
    }

    @Override
    public TypeScriptDelegator writerDelegator() {
        return writerDelegator;
    }

    @Override
    public List<TypeScriptIntegration> integrations() {
        return integrations;
    }

    public List<RuntimeClientPlugin> runtimePlugins() {
        return runtimePlugins;
    }

    public ProtocolGenerator protocolGenerator() {
        return protocolGenerator;
    }

    public ApplicationProtocol applicationProtocol() {
        return applicationProtocol;
    }

    /**
     * @return Returns a builder.
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builds {@link TypeScriptCodegenContext}s.
     */
    public static final class Builder implements SmithyBuilder<TypeScriptCodegenContext> {

        private Model model;
        private TypeScriptSettings settings;
        private SymbolProvider symbolProvider;
        private FileManifest fileManifest;
        private TypeScriptDelegator writerDelegator;
        private List<TypeScriptIntegration> integrations = new ArrayList<>();
        private List<RuntimeClientPlugin> runtimePlugins = new ArrayList<>();
        private ProtocolGenerator protocolGenerator;
        private ApplicationProtocol applicationProtocol;

        @Override
        public TypeScriptCodegenContext build() {
            return new TypeScriptCodegenContext(this);
        }

        /**
         * @param model The model being generated.
         * @return Returns the builder.
         */
        public Builder model(Model model) {
            this.model = model;
            return this;
        }

        /**
         * @param settings The resolved settings for the generator.
         * @return Returns the builder.
         */
        public Builder settings(TypeScriptSettings settings) {
            this.settings = settings;
            return this;
        }

        /**
         * @param symbolProvider The finalized symbol provider for the generator.
         * @return Returns the builder.
         */
        public Builder symbolProvider(SymbolProvider symbolProvider) {
            this.symbolProvider = symbolProvider;
            return this;
        }

        /**
         * @param fileManifest The file manifest being used in the generator.
         * @return Returns the builder.
         */
        public Builder fileManifest(FileManifest fileManifest) {
            this.fileManifest = fileManifest;
            return this;
        }

        /**
         * @param writerDelegator The writer delegator to use in the generator.
         * @return Returns the builder.
         */
        public Builder writerDelegator(TypeScriptDelegator writerDelegator) {
            this.writerDelegator = writerDelegator;
            return this;
        }

        /**
         * @param integrations The integrations to use in the generator.
         * @return Returns the builder.
         */
        public Builder integrations(List<TypeScriptIntegration> integrations) {
            this.integrations.clear();
            this.integrations.addAll(integrations);
            return this;
        }

        /**
         * @param runtimePlugins The runtime plugins to use in the generator.
         * @return Returns the builder.
         */
        public Builder runtimePlugins(List<RuntimeClientPlugin> runtimePlugins) {
            this.runtimePlugins.clear();
            this.runtimePlugins.addAll(runtimePlugins);
            return this;
        }

        /**
         * @param protocolGenerator The protocol generator to use in the generator.
         * @return Returns the builder.
         */
        public Builder protocolGenerator(ProtocolGenerator protocolGenerator) {
            this.protocolGenerator = protocolGenerator;
            return this;
        }

        /**
         * @param applicationProtocol The application protocol to use in the generator.
         * @return Returns the builder.
         */
        public Builder applicationProtocol(ApplicationProtocol applicationProtocol) {
            this.applicationProtocol = applicationProtocol;
            return this;
        }
    }
}
