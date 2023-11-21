/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Function;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthOptionProperty.Type;
import software.amazon.smithy.utils.BuilderRef;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyUnstableApi;
import software.amazon.smithy.utils.ToSmithyBuilder;

/**
 * feat(experimentalIdentityAndAuth): Defines an HttpAuthScheme used in code generation.
 *
 * HttpAuthScheme defines everything needed to generate an HttpAuthSchemeProvider,
 * HttpAuthOptions, and registered HttpAuthSchemes in the IdentityProviderConfiguration.
 */
@SmithyUnstableApi
public final class HttpAuthScheme implements ToSmithyBuilder<HttpAuthScheme> {
    private final ShapeId schemeId;
    private final ShapeId traitId;
    private final ApplicationProtocol applicationProtocol;
    private final Map<LanguageTarget, Consumer<TypeScriptWriter>> defaultIdentityProviders;
    private final Map<LanguageTarget, Consumer<TypeScriptWriter>> defaultSigners;
    private final List<ConfigField> configFields;
    private final List<ResolveConfigFunction> resolveConfigFunctions;
    private final List<HttpAuthSchemeParameter> httpAuthSchemeParameters;
    private final List<HttpAuthOptionProperty> httpAuthOptionProperties;
    private final Function<Symbol, Consumer<TypeScriptWriter>> propertiesExtractor;

    private HttpAuthScheme(Builder builder) {
        this.schemeId = SmithyBuilder.requiredState(
            "schemeId", builder.schemeId);
        this.traitId = builder.traitId != null ? builder.traitId : schemeId;
        this.applicationProtocol = SmithyBuilder.requiredState(
            "applicationProtocol", builder.applicationProtocol);
        this.defaultIdentityProviders = SmithyBuilder.requiredState(
            "defaultIdentityProviders", builder.defaultIdentityProviders.copy());
        this.defaultSigners = SmithyBuilder.requiredState(
            "defaultSigners", builder.defaultSigners.copy());
        this.configFields = SmithyBuilder.requiredState(
            "configFields", builder.configFields.copy());
        this.resolveConfigFunctions = SmithyBuilder.requiredState(
            "resolveConfigFunctions", builder.resolveConfigFunctions.copy());
        this.httpAuthSchemeParameters = SmithyBuilder.requiredState(
            "httpAuthSchemeParameters", builder.httpAuthSchemeParameters.copy());
        this.httpAuthOptionProperties = SmithyBuilder.requiredState(
            "httpAuthOptionProperties", builder.httpAuthOptionProperties.copy());
        this.propertiesExtractor =
            builder.propertiesExtractor;
    }

    /**
     * Gets the scheme ID.
     * @return schemeId
     */
    public ShapeId getSchemeId() {
        return schemeId;
    }

    /**
     * Gets the trait ID.
     * @return traitId
     */
    public ShapeId getTraitId() {
        return traitId;
    }

    /**
     * Gets the application protocol.
     * @return applicationProtocol
     */
    public ApplicationProtocol getApplicationProtocol() {
        return applicationProtocol;
    }

    /**
     * Gets the map of default {@code IdentityProvider}s for an auth scheme.
     * @return defaultIdentityProviders
     */
    public Map<LanguageTarget, Consumer<TypeScriptWriter>> getDefaultIdentityProviders() {
        return defaultIdentityProviders;
    }

    /**
     * Gets the map of default {@code HttpSigner}s for an auth scheme.
     * @return defaultSigners
     */
    public Map<LanguageTarget, Consumer<TypeScriptWriter>> getDefaultSigners() {
        return defaultSigners;
    }

    /**
     * Gets the list of config fields for an auth scheme.
     * @return configFields
     */
    public List<ConfigField> getConfigFields() {
        return configFields;
    }

    public List<ResolveConfigFunction> getResolveConfigFunctions() {
        return resolveConfigFunctions;
    }

    /**
     * Gets the list of auth scheme parameters for an auth scheme.
     * @return httpAuthSchemeParameters
     */
    public List<HttpAuthSchemeParameter> getHttpAuthSchemeParameters() {
        return httpAuthSchemeParameters;
    }

    /**
     * Gets the list of auth option properties for an auth scheme.
     * @return httpAuthOptionProperties
     */
    public List<HttpAuthOptionProperty> getHttpAuthOptionProperties() {
        return httpAuthOptionProperties;
    }

    /**
     * Gets the list of auth option properties by type for an auth scheme.
     * @param type type of auth option property
     * @return httpAuthOptionProperties filtered by type
     */
    public List<HttpAuthOptionProperty> getHttpAuthSchemeOptionParametersByType(Type type) {
        return httpAuthOptionProperties.stream().filter(p -> p.type().equals(type)).toList();
    }

    /**
     * Gets the writer for the config properties extractor.
     * @return optional of config properties extractor
     */
    public Optional<Function<Symbol, Consumer<TypeScriptWriter>>> getPropertiesExtractor() {
        return Optional.ofNullable(propertiesExtractor);
    }


    /**
     * Creates a {@link Builder}.
     * @return a builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Converts an HttpAuthScheme to a {@link Builder}.
     * @return a builder
     */
    @Override
    public Builder toBuilder() {
        return builder()
            .schemeId(schemeId)
            .traitId(traitId)
            .applicationProtocol(applicationProtocol)
            .defaultIdentityProviders(defaultIdentityProviders)
            .defaultSigners(defaultSigners)
            .configFields(configFields)
            .resolveConfigFunctions(resolveConfigFunctions)
            .httpAuthSchemeParameters(httpAuthSchemeParameters)
            .httpAuthOptionProperties(httpAuthOptionProperties)
            .propertiesExtractor(propertiesExtractor);
    }

    /**
     * Builder for {@link HttpAuthScheme}.
     */
    public static final class Builder implements SmithyBuilder<HttpAuthScheme> {
        private ShapeId schemeId;
        private ShapeId traitId;
        private ApplicationProtocol applicationProtocol;
        private BuilderRef<Map<LanguageTarget, Consumer<TypeScriptWriter>>> defaultIdentityProviders =
            BuilderRef.forOrderedMap();
        private BuilderRef<Map<LanguageTarget, Consumer<TypeScriptWriter>>> defaultSigners =
            BuilderRef.forOrderedMap();
        private BuilderRef<List<ConfigField>> configFields =
            BuilderRef.forList();
        private BuilderRef<List<ResolveConfigFunction>> resolveConfigFunctions =
            BuilderRef.forList();
        private BuilderRef<List<HttpAuthSchemeParameter>> httpAuthSchemeParameters =
            BuilderRef.forList();
        private BuilderRef<List<HttpAuthOptionProperty>> httpAuthOptionProperties =
            BuilderRef.forList();
        private Function<Symbol, Consumer<TypeScriptWriter>> propertiesExtractor;

        private Builder() {}

        @Override
        public HttpAuthScheme build() {
            return new HttpAuthScheme(this);
        }

        /**
         * Sets the schemeId.
         * @param schemeId scheme ID to set
         * @return the builder
         */
        public Builder schemeId(ShapeId schemeId) {
            this.schemeId = schemeId;
            return this;
        }

        /**
         * Sets the traitId.
         * @param traitId trait ID to set
         * @return the builder
         */
        public Builder traitId(ShapeId traitId) {
            this.traitId = traitId;
            return this;
        }

        /**
         * Sets the applicationProtocol.
         * @param applicationProtocol application protocol to set
         * @return the builder
         */
        public Builder applicationProtocol(ApplicationProtocol applicationProtocol) {
            this.applicationProtocol = applicationProtocol;
            return this;
        }

        /**
         * Sets the defaultIdentityProviders.
         * @param defaultIdentityProviders IdentityProviders to set
         * @return the builder
         */
        public Builder defaultIdentityProviders(
            Map<LanguageTarget, Consumer<TypeScriptWriter>> defaultIdentityProviders) {
            this.defaultIdentityProviders.clear();
            this.defaultIdentityProviders.get().putAll(defaultIdentityProviders);
            return this;
        }

        /**
         * Puts a single default identityProvider for a language target.
         * @param languageTarget target to add identityProvider to
         * @param identityProvider identityProvider to add
         * @return the builder
         */
        public Builder putDefaultIdentityProvider(
            LanguageTarget languageTarget,
            Consumer<TypeScriptWriter> identityProvider
        ) {
            this.defaultIdentityProviders.get().put(languageTarget, identityProvider);
            return this;
        }

        /**
         * Removes a single default identityProvider for a language target.
         * @param languageTarget target to remove the identityProvider from
         * @return the builder
         */
        public Builder removeDefaultIdentityProvider(LanguageTarget languageTarget) {
            this.defaultIdentityProviders.get().remove(languageTarget);
            return this;
        }

        /**
         * Sets the defaultSigners.
         * @param defaultSigners HttpSigners to set
         * @return the builder
         */
        public Builder defaultSigners(
            Map<LanguageTarget, Consumer<TypeScriptWriter>> defaultSigners) {
            this.defaultSigners.clear();
            this.defaultSigners.get().putAll(defaultSigners);
            return this;
        }

        /**
         * Puts a single default signer for a language target.
         * @param languageTarget target to add signer to
         * @param signer signer to add
         * @return the builder
         */
        public Builder putDefaultSigner(
            LanguageTarget languageTarget,
            Consumer<TypeScriptWriter> signer
        ) {
            this.defaultSigners.get().put(languageTarget, signer);
            return this;
        }

        /**
         * Removes a single default signer for a language target.
         * @param languageTarget target to remove the signer from
         * @return the builder
         */
        public Builder removeDefaultSigner(LanguageTarget languageTarget) {
            this.defaultSigners.get().remove(languageTarget);
            return this;
        }

        /**
         * Sets the configFields.
         * @param configFields config fields to set
         * @return the builder
         */
        public Builder configFields(List<ConfigField> configFields) {
            this.configFields.clear();
            this.configFields.get().addAll(configFields);
            return this;
        }

        /**
         * Adds a config field.
         * @param configField config field to add
         * @return the builder
         */
        public Builder addConfigField(ConfigField configField) {
            this.configFields.get().add(configField);
            return this;
        }

        /**
         * Removes a config field by name.
         * @param configField name of the config field to remove
         * @return the builder
         */
        public Builder removeConfigField(String configField) {
            this.configFields.get().removeIf(c -> c.name().equals(configField));
            return this;
        }

        public Builder resolveConfigFunctions(List<ResolveConfigFunction> resolveConfigFunctions) {
            this.resolveConfigFunctions.clear();
            this.resolveConfigFunctions.get().addAll(resolveConfigFunctions);
            return this;
        }

        public Builder addResolveConfigFunction(ResolveConfigFunction resolveConfigFunction) {
            this.resolveConfigFunctions.get().add(resolveConfigFunction);
            return this;
        }

        public Builder removeResolveConfigFunction(Symbol resolveConfigFunction) {
            this.resolveConfigFunctions.get().removeIf(c -> c.resolveConfigFunction().equals(resolveConfigFunction));
            return this;
        }

        /**
         * Sets the httpAuthSchemeParameters.
         * @param httpAuthSchemeParameters auth scheme parameters to set
         * @return the builder
         */
        public Builder httpAuthSchemeParameters(
            List<HttpAuthSchemeParameter> httpAuthSchemeParameters) {
            this.httpAuthSchemeParameters.clear();
            this.httpAuthSchemeParameters.get().addAll(httpAuthSchemeParameters);
            return this;
        }

        /**
         * Adds an auth scheme parameter.
         * @param httpAuthSchemeParameter parameter to add
         * @return the builder
         */
        public Builder addHttpAuthSchemeParameter(HttpAuthSchemeParameter httpAuthSchemeParameter) {
            this.httpAuthSchemeParameters.get().add(httpAuthSchemeParameter);
            return this;
        }

        /**
         * Removes an auth scheme parameter by name.
         * @param httpAuthSchemeParameter name of the auth scheme parameter to remove
         * @return the builder
         */
        public Builder removeHttpAuthSchemeParameter(String httpAuthSchemeParameter) {
            this.httpAuthSchemeParameters.get().removeIf(p -> p.name().equals(httpAuthSchemeParameter));
            return this;
        }

        /**
         * Sets the httpAuthOptionProperties.
         * @param httpAuthOptionProperties properties to set
         * @return the builder
         */
        public Builder httpAuthOptionProperties(
            List<HttpAuthOptionProperty> httpAuthOptionProperties) {
            this.httpAuthOptionProperties.clear();
            this.httpAuthOptionProperties.get().addAll(httpAuthOptionProperties);
            return this;
        }

        /**
         * Adds an auth option property.
         * @param httpAuthOptionProperty property to add
         * @return the builder
         */
        public Builder addHttpAuthOptionProperty(HttpAuthOptionProperty httpAuthOptionProperty) {
            this.httpAuthOptionProperties.get().add(httpAuthOptionProperty);
            return this;
        }

        /**
         * Removes an auth option property.
         * @param httpAuthOptionProperty name of the auth option property to remove
         * @return the builder
         */
        public Builder removeHttpAuthOptionProperty(String httpAuthOptionProperty) {
            this.httpAuthOptionProperties.get().removeIf(p -> p.name().equals(httpAuthOptionProperty));
            return this;
        }

        /**
         * Sets the propertiesExtractor.
         * @param propertiesExtractor writer for properties extractor
         * @return the builder
         */
        public Builder propertiesExtractor(
            Function<Symbol, Consumer<TypeScriptWriter>> propertiesExtractor) {
            this.propertiesExtractor = propertiesExtractor;
            return this;
        }
    }
}
