/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.ConfigField;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenContext;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.auth.AuthUtils;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.typescript.codegen.auth.http.SupportedHttpAuthSchemesIndex;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention;
import software.amazon.smithy.typescript.codegen.sections.ClientPropertiesCodeSection;
import software.amazon.smithy.utils.CodeInterceptor;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Add config and middleware for {@code httpAuthSchemeMiddleware}.
 */
@SmithyInternalApi
public final class AddHttpAuthSchemeMiddleware implements HttpAuthTypeScriptIntegration {
    /**
     * Integration should only be used if `experimentalIdentityAndAuth` flag is true.
     */
    @Override
    public boolean matchesSettings(TypeScriptSettings settings) {
        return settings.getExperimentalIdentityAndAuth();
    }

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        return List.of(
            RuntimeClientPlugin.builder()
                .servicePredicate((m, s) -> s.hasTrait(EndpointRuleSetTrait.ID))
                .withConventions(
                    TypeScriptDependency.SMITHY_CORE.dependency,
                    "HttpAuthSchemeEndpointRuleSet",
                    Convention.HAS_MIDDLEWARE)
                .additionalPluginFunctionParamsSupplier((model, service, operation) -> Map.of(
                    "httpAuthSchemeParametersProvider", Symbol.builder()
                        .name("this.getDefaultHttpAuthSchemeParametersProvider()")
                        .build(),
                    "identityProviderConfigProvider", Symbol.builder()
                        .name("this.getIdentityProviderConfigProvider()")
                        .build()
                ))
                .build(),
            RuntimeClientPlugin.builder()
                .servicePredicate((m, s) -> !s.hasTrait(EndpointRuleSetTrait.ID))
                .withConventions(
                    TypeScriptDependency.SMITHY_CORE.dependency,
                    "HttpAuthScheme",
                    Convention.HAS_MIDDLEWARE)
                .additionalPluginFunctionParamsSupplier((model, service, operation) -> Map.of(
                    "httpAuthSchemeParametersProvider", Symbol.builder()
                        .name("this.getDefaultHttpAuthSchemeParametersProvider()")
                        .build(),
                    "identityProviderConfigProvider", Symbol.builder()
                        .name("this.getIdentityProviderConfigProvider()")
                        .build()
                ))
                .build(),
            RuntimeClientPlugin.builder()
                .inputConfig(Symbol.builder()
                        .namespace(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_MODULE, "/")
                        .name("HttpAuthSchemeInputConfig")
                        .build())
                .resolvedConfig(Symbol.builder()
                        .namespace(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_MODULE, "/")
                        .name("HttpAuthSchemeResolvedConfig")
                        .build())
                .resolveFunction(Symbol.builder()
                        .namespace(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_MODULE, "/")
                        .name("resolveHttpAuthSchemeConfig")
                        .build())
                .build()
        );
    }

    @Override
    public List<? extends CodeInterceptor<? extends CodeSection, TypeScriptWriter>> interceptors(
        TypeScriptCodegenContext codegenContext
    ) {
        return List.of(CodeInterceptor.appender(ClientPropertiesCodeSection.class, (w, s) -> {
            if (!s.getSettings().generateClient()
                || !s.getSettings().getExperimentalIdentityAndAuth()
                || !s.getApplicationProtocol().isHttpProtocol()) {
                return;
            }

            /*
            private getDefaultHttpAuthSchemeParametersProvider() {
              return defaultWeatherHttpAuthSchemeParametersProvider;
            }
            */
            w.openBlock("private getDefaultHttpAuthSchemeParametersProvider() {", "}\n", () -> {
                String httpAuthSchemeParametersProviderName = "default"
                    + CodegenUtils.getServiceName(s.getSettings(), s.getModel(), s.getSymbolProvider())
                    + "HttpAuthSchemeParametersProvider";
                w.addImport(httpAuthSchemeParametersProviderName, null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
                w.write("return " + httpAuthSchemeParametersProviderName + ";");
            });

            /*
            private getIdentityProviderConfigProvider() {
              return async (config: WeatherClientResolvedConfig) => new DefaultIdentityProviderConfig({
                "aws.auth#sigv4": config.credentials,
                "smithy.api#httpApiKeyAuth": config.apiKey,
                "smithy.api#httpBearerAuth": config.token,
              });
            }
            */
            w.openBlock("private getIdentityProviderConfigProvider() {", "}\n", () -> {
                w.addDependency(TypeScriptDependency.SMITHY_CORE);
                w.addImport("DefaultIdentityProviderConfig", null, TypeScriptDependency.SMITHY_CORE);
                w.openBlock("""
                    return async (config: $LResolvedConfig) => \
                    new DefaultIdentityProviderConfig({""", "});",
                    s.getSymbolProvider().toSymbol(s.getService()).getName(),
                    () -> {
                    SupportedHttpAuthSchemesIndex authIndex = new SupportedHttpAuthSchemesIndex(s.getIntegrations());
                    ServiceIndex serviceIndex = ServiceIndex.of(s.getModel());
                    Map<ShapeId, HttpAuthScheme> httpAuthSchemes
                        = AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(s.getService(), serviceIndex, authIndex);
                    // TODO(experimentalIdentityAndAuth): figure out a better deduping strategy
                    Map<String, ConfigField> visitedConfigFields = new HashMap<>();
                    for (HttpAuthScheme scheme : httpAuthSchemes.values()) {
                        if (scheme == null) {
                            continue;
                        }
                        for (ConfigField configField : scheme.getConfigFields()) {
                            if (visitedConfigFields.containsKey(configField.name())) {
                                ConfigField visitedConfigField = visitedConfigFields.get(configField.name());
                                if (!configField.equals(visitedConfigField)) {
                                    throw new CodegenException("Contradicting `ConfigField` defintions for `"
                                        + configField.name()
                                        + "`; existing: "
                                        + visitedConfigField
                                        + ", conflict: "
                                        + configField);
                                }
                            } else {
                                visitedConfigFields.put(configField.name(), configField);
                                if (configField.type().equals(ConfigField.Type.MAIN)) {
                                    w.write("$S: config.$L,", scheme.getSchemeId().toString(), configField.name());
                                }
                            }
                        }
                    }
                });
            });
        }));
    }

    @Override
    public void customize(TypeScriptCodegenContext codegenContext) {
        if (!codegenContext.settings().generateClient()
            || !codegenContext.settings().getExperimentalIdentityAndAuth()
            || !codegenContext.applicationProtocol().isHttpProtocol()) {
            return;
        }

        codegenContext.writerDelegator().useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            SupportedHttpAuthSchemesIndex authIndex = new SupportedHttpAuthSchemesIndex(codegenContext.integrations());
            String serviceName = CodegenUtils.getServiceName(
                codegenContext.settings(), codegenContext.model(), codegenContext.symbolProvider());
            ServiceShape serviceShape = codegenContext.settings().getService(codegenContext.model());
            ServiceIndex serviceIndex = ServiceIndex.of(codegenContext.model());
            Map<ShapeId, HttpAuthScheme> httpAuthSchemes
                = AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(serviceShape, serviceIndex, authIndex);
            Map<String, ConfigField> configFields =
                AuthUtils.collectConfigFields(httpAuthSchemes.values());

            generateHttpAuthSchemeInputConfigInterface(w, configFields, serviceName);
            generateHttpAuthSchemeResolvedConfigInterface(w, configFields, serviceName);
            generateResolveHttpAuthSchemeConfigFunction(w, configFields, httpAuthSchemes, authIndex);
        });
    }

    /*
    export interface HttpAuthSchemeInputConfig {
      httpAuthSchemes?: HttpAuthScheme[];

      httpAuthSchemeProvider?: WeatherHttpAuthSchemeProvider;

      apiKey?: ApiKeyIdentity | ApiKeyIdentityProvider;

      token?: TokenIdentity | TokenIdentityProvider;

      region?: string | __Provider<string>;

      credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
    }
    */
    private void generateHttpAuthSchemeInputConfigInterface(
        TypeScriptWriter w,
        Map<String, ConfigField> configFields,
        String serviceName
    ) {
        w.openBlock("""
            /**
             * @internal
             */
            export interface HttpAuthSchemeInputConfig {""", "}\n", () -> {
                w.addDependency(TypeScriptDependency.SMITHY_TYPES);
                w.addImport("HttpAuthScheme", null, TypeScriptDependency.SMITHY_TYPES);
                w.writeDocs("""
                    experimentalIdentityAndAuth: Configuration of HttpAuthSchemes for a client which provides \
                    default identity providers and signers per auth scheme.
                    @internal""");
                w.write("httpAuthSchemes?: HttpAuthScheme[];\n");

                String httpAuthSchemeProviderName = serviceName + "HttpAuthSchemeProvider";
                w.writeDocs("""
                    experimentalIdentityAndAuth: Configuration of an HttpAuthSchemeProvider for a client which \
                    resolves which HttpAuthScheme to use.
                    @internal""");
                w.write("httpAuthSchemeProvider?: $L;\n", httpAuthSchemeProviderName);

                for (ConfigField configField : configFields.values()) {
                    w.writeDocs(() -> w.write("$C", configField.docs()));
                    w.write("$L?: $C;", configField.name(), configField.inputType());
                }
            });
    }

    /*
    export interface HttpAuthSchemeResolvedConfig {
      readonly httpAuthSchemes: HttpAuthScheme[];

      readonly httpAuthSchemeProvider: WeatherHttpAuthSchemeProvider;

      readonly apiKey?: ApiKeyIdentityProvider;

      readonly token?: TokenIdentityProvider;

      readonly region?: __Provider<string>;

      readonly credentials?: AwsCredentialIdentityProvider;
    }
    */
    private void generateHttpAuthSchemeResolvedConfigInterface(
        TypeScriptWriter w,
        Map<String, ConfigField> configFields,
        String serviceName
    ) {
        w.openBlock("""
            /**
             * @internal
             */
            export interface HttpAuthSchemeResolvedConfig {""", "}\n", () -> {
                w.addDependency(TypeScriptDependency.SMITHY_TYPES);
                w.addImport("HttpAuthScheme", null, TypeScriptDependency.SMITHY_TYPES);
                w.writeDocs("""
                    experimentalIdentityAndAuth: Configuration of HttpAuthSchemes for a client which provides \
                    default identity providers and signers per auth scheme.
                    @internal""");
                w.write("readonly httpAuthSchemes: HttpAuthScheme[];\n");

                String httpAuthSchemeProviderName = serviceName + "HttpAuthSchemeProvider";
                w.writeDocs("""
                    experimentalIdentityAndAuth: Configuration of an HttpAuthSchemeProvider for a client which \
                    resolves which HttpAuthScheme to use.
                    @internal""");
                w.write("readonly httpAuthSchemeProvider: $L;\n", httpAuthSchemeProviderName);

                for (ConfigField configField : configFields.values()) {
                    w.writeDocs(() -> w.write("$C", configField.docs()));
                    w.write("readonly $L?: $C;", configField.name(), configField.resolvedType());
                }
            });
    }

    /*
    export const resolveHttpAuthSchemeConfig = (config: HttpAuthSchemeInputConfig): HttpAuthSchemeResolvedConfig => {
      const credentials = memoizeIdentityProvider(config.credentials, isIdentityExpired, doesIdentityRequireRefresh);
      const region = config.region ? normalizeProvider(config.region) : undefined;
      const apiKey = memoizeIdentityProvider(config.apiKey, isIdentityExpired, doesIdentityRequireRefresh);
      const token = memoizeIdentityProvider(config.token, isIdentityExpired, doesIdentityRequireRefresh);
      return {
        ...config,
        credentials,
        region,
        apiKey,
        token,
      } as HttpAuthSchemeResolvedConfig;
    };
    */
    private void generateResolveHttpAuthSchemeConfigFunction(
        TypeScriptWriter w,
        Map<String, ConfigField> configFields,
        Map<ShapeId, HttpAuthScheme> httpAuthSchemes,
        SupportedHttpAuthSchemesIndex authIndex
    ) {
        w.openBlock("""
            /**
             * @internal
             */
            export const resolveHttpAuthSchemeConfig = (config: HttpAuthSchemeInputConfig): \
            HttpAuthSchemeResolvedConfig => {""", "};", () -> {
                // TODO(experimentalIdentityAndAuth): figure out a better way to configure resolving identities
                w.addDependency(TypeScriptDependency.SMITHY_CORE);
                for (ConfigField configField : configFields.values()) {
                    if (configField.type().equals(ConfigField.Type.MAIN)) {
                        w.addDependency(TypeScriptDependency.SMITHY_CORE);
                        w.addImport("memoizeIdentityProvider", null,
                            TypeScriptDependency.SMITHY_CORE);
                        w.addImport("isIdentityExpired", null,
                            TypeScriptDependency.SMITHY_CORE);
                        w.addImport("doesIdentityRequireRefresh", null,
                            TypeScriptDependency.SMITHY_CORE);
                        w.write("""
                            const $L = memoizeIdentityProvider(config.$L, isIdentityExpired, \
                            doesIdentityRequireRefresh);""",
                            configField.name(),
                            configField.name());
                    }
                    if (configField.type().equals(ConfigField.Type.AUXILIARY)) {
                        w.addDependency(TypeScriptDependency.UTIL_MIDDLEWARE);
                        w.addImport("normalizeProvider", null, TypeScriptDependency.UTIL_MIDDLEWARE);
                        w.write("const $L = config.$L ? normalizeProvider(config.$L) : undefined;",
                            configField.name(),
                            configField.name(),
                            configField.name());
                    }
                }
                w.openBlock("return {", "} as HttpAuthSchemeResolvedConfig;", () -> {
                    w.write("...config,");
                    for (ConfigField configField : configFields.values()) {
                        w.write("$L,", configField.name());
                    }
                });
            });
    }
}
