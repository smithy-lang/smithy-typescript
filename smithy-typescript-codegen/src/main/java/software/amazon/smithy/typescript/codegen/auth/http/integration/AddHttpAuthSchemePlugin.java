/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenContext;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.auth.AuthUtils;
import software.amazon.smithy.typescript.codegen.auth.http.ConfigField;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.typescript.codegen.auth.http.ResolveConfigFunction;
import software.amazon.smithy.typescript.codegen.auth.http.SupportedHttpAuthSchemesIndex;
import software.amazon.smithy.typescript.codegen.auth.http.sections.HttpAuthSchemeInputConfigInterfaceCodeSection;
import software.amazon.smithy.typescript.codegen.auth.http.sections.HttpAuthSchemeResolvedConfigInterfaceCodeSection;
import software.amazon.smithy.typescript.codegen.auth.http.sections.ResolveHttpAuthSchemeConfigFunctionCodeSection;
import software.amazon.smithy.typescript.codegen.auth.http.sections.ResolveHttpAuthSchemeConfigFunctionConfigFieldsCodeSection;
import software.amazon.smithy.typescript.codegen.auth.http.sections.ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection;
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
public final class AddHttpAuthSchemePlugin implements HttpAuthTypeScriptIntegration {
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
                    SupportedHttpAuthSchemesIndex authIndex = new SupportedHttpAuthSchemesIndex(
                        s.getIntegrations(),
                        s.getModel(),
                        s.getSettings());
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
                                    throw new CodegenException("Contradicting `ConfigField` definitions for `"
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
            SupportedHttpAuthSchemesIndex authIndex = new SupportedHttpAuthSchemesIndex(
                codegenContext.integrations(),
                codegenContext.model(),
                codegenContext.settings());
            ServiceShape serviceShape = codegenContext.settings().getService(codegenContext.model());
            ServiceIndex serviceIndex = ServiceIndex.of(codegenContext.model());
            Map<ShapeId, HttpAuthScheme> httpAuthSchemes =
                AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(serviceShape, serviceIndex, authIndex);
            Map<String, ConfigField> configFields =
                AuthUtils.collectConfigFields(httpAuthSchemes.values());
            Map<Symbol, ResolveConfigFunction> resolveConfigFunctions =
                AuthUtils.collectResolveConfigFunctions(httpAuthSchemes.values());

            generateHttpAuthSchemeInputConfigInterface(w, HttpAuthSchemeInputConfigInterfaceCodeSection.builder()
                .service(serviceShape)
                .settings(codegenContext.settings())
                .model(codegenContext.model())
                .symbolProvider(codegenContext.symbolProvider())
                .integrations(codegenContext.integrations())
                .configFields(configFields)
                .resolveConfigFunctions(resolveConfigFunctions)
                .build());
            generateHttpAuthSchemeResolvedConfigInterface(w, HttpAuthSchemeResolvedConfigInterfaceCodeSection.builder()
                .service(serviceShape)
                .settings(codegenContext.settings())
                .model(codegenContext.model())
                .symbolProvider(codegenContext.symbolProvider())
                .integrations(codegenContext.integrations())
                .configFields(configFields)
                .resolveConfigFunctions(resolveConfigFunctions)
                .build());
            generateResolveHttpAuthSchemeConfigFunction(w, ResolveHttpAuthSchemeConfigFunctionCodeSection.builder()
                .service(serviceShape)
                .settings(codegenContext.settings())
                .model(codegenContext.model())
                .symbolProvider(codegenContext.symbolProvider())
                .integrations(codegenContext.integrations())
                .configFields(configFields)
                .resolveConfigFunctions(resolveConfigFunctions)
                .build());
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
        HttpAuthSchemeInputConfigInterfaceCodeSection s
    ) {
        w.pushState(s);
        Map<String, ConfigField> configFields = s.getConfigFields();
        Map<Symbol, ResolveConfigFunction> resolveConfigFunctions =
            s.getResolveConfigFunctions();
        String serviceName = CodegenUtils.getServiceName(
            s.getSettings(), s.getModel(), s.getSymbolProvider());
        w.writeDocs("@internal");
        w.writeInline("export interface HttpAuthSchemeInputConfig");
        if (!resolveConfigFunctions.isEmpty()) {
            w.writeInline(" extends ");
            Iterator<ResolveConfigFunction> iter = resolveConfigFunctions.values().iterator();
            while (iter.hasNext()) {
                ResolveConfigFunction entry = iter.next();
                w.writeInline("$T", entry.inputConfig());
                if (iter.hasNext()) {
                    w.writeInline(", ");
                }
            }
        }
        w.write(" {");
        w.indent();
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
            configField.docs().ifPresent(docs -> w.writeDocs(() -> w.write("$C", docs)));
            w.write("$L?: $T;", configField.name(), configField.inputType());
        }
        w.dedent();
        w.write("}\n");
        w.popState();
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
        HttpAuthSchemeResolvedConfigInterfaceCodeSection s
    ) {
        w.pushState(s);
        Map<String, ConfigField> configFields = s.getConfigFields();
        Map<Symbol, ResolveConfigFunction> resolveConfigFunctions =
            s.getResolveConfigFunctions();
        String serviceName = CodegenUtils.getServiceName(
            s.getSettings(), s.getModel(), s.getSymbolProvider());
        w.writeDocs("@internal");
        w.writeInline("export interface HttpAuthSchemeResolvedConfig");
        if (!resolveConfigFunctions.isEmpty()) {
            w.writeInline(" extends ");
            Iterator<ResolveConfigFunction> iter = resolveConfigFunctions.values().iterator();
            while (iter.hasNext()) {
                ResolveConfigFunction entry = iter.next();
                w.writeInline("$T", entry.resolvedConfig());
                if (iter.hasNext()) {
                    w.writeInline(", ");
                }
            }
        }
        w.write(" {");
        w.indent();
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
            configField.docs().ifPresent(docs -> w.writeDocs(() -> w.write("$C", docs)));
            w.write("readonly $L?: $T;", configField.name(), configField.resolvedType());
        }
        w.dedent();
        w.write("}\n");
        w.popState();
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
        ResolveHttpAuthSchemeConfigFunctionCodeSection s
    ) {
        w.pushState(s);
        Map<String, ConfigField> configFields = s.getConfigFields();
        Map<Symbol, ResolveConfigFunction> resolveConfigFunctions = s.getResolveConfigFunctions();
        w.writeDocs("@internal");
        w.writeInline("export const resolveHttpAuthSchemeConfig = <T>(config: T & HttpAuthSchemeInputConfig");
        if (!resolveConfigFunctions.isEmpty()) {
            w.writeInline(" & ");
            Iterator<ResolveConfigFunction> iter = resolveConfigFunctions.values().iterator();
            while (iter.hasNext()) {
                ResolveConfigFunction entry = iter.next();
                w.writeInline("$T", entry.inputConfig());
                entry.previouslyResolved().ifPresent(p -> w.writeInline(" & $T", p));
                if (iter.hasNext()) {
                    w.writeInline(" & ");
                }
            }
        }
        w.writeInline("): T & HttpAuthSchemeResolvedConfig");
        if (!resolveConfigFunctions.isEmpty()) {
            w.writeInline(" & ");
            Iterator<ResolveConfigFunction> iter = resolveConfigFunctions.values().iterator();
            while (iter.hasNext()) {
                ResolveConfigFunction entry = iter.next();
                w.writeInline("$T", entry.resolvedConfig());
                if (iter.hasNext()) {
                    w.writeInline(" & ");
                }
            }
        }
        w.write(" => {");
        w.indent();
        w.pushState(ResolveHttpAuthSchemeConfigFunctionConfigFieldsCodeSection.builder()
            .service(s.getService())
            .settings(s.getSettings())
            .model(s.getModel())
            .symbolProvider(s.getSymbolProvider())
            .integrations(s.getIntegrations())
            .configFields(configFields)
            .build());
        w.addDependency(TypeScriptDependency.SMITHY_CORE);
        for (ConfigField configField : configFields.values()) {
            configField.configFieldWriter().accept(w, configField);
        }
        w.popState();
        w.pushState(ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection.builder()
            .service(s.getService())
            .settings(s.getSettings())
            .model(s.getModel())
            .symbolProvider(s.getSymbolProvider())
            .integrations(s.getIntegrations())
            .configFields(configFields)
            .build());

        for (ResolveConfigFunction resolveConfigFunction : resolveConfigFunctions.values()) {
            w.write("config = $T(config);", resolveConfigFunction.resolveConfigFunction());
        }
        w.openBlock("return {", "} as T & HttpAuthSchemeResolvedConfig;", () -> {
            w.write("...config,");
            for (ConfigField configField : configFields.values()) {
                w.write("$L,", configField.name());
            }
        });
        w.popState();
        w.dedent();
        w.write("};");
        w.popState();
    }
}
