/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
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
import software.amazon.smithy.typescript.codegen.sections.ClientBodyExtraCodeSection;
import software.amazon.smithy.typescript.codegen.util.ClientWriterConsumer;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Add config and middleware for {@code httpAuthSchemeMiddleware}.
 */
@SmithyInternalApi
public final class AddHttpAuthSchemePlugin implements HttpAuthTypeScriptIntegration {
    /**
     * Integration should be skipped if the `useLegacyAuth` flag is true.
     */
    @Override
    public boolean matchesSettings(TypeScriptSettings settings) {
        return !settings.useLegacyAuth();
    }

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        Map<String, ClientWriterConsumer> httpAuthSchemeParametersProvider = Map.of(
            "httpAuthSchemeParametersProvider", AddHttpAuthSchemePlugin::httpAuthSchemeParametersProvider,
            "identityProviderConfigProvider", AddHttpAuthSchemePlugin::identityProviderConfigProvider
        );
        return List.of(
            RuntimeClientPlugin.builder()
                .withConventions(
                    TypeScriptDependency.SMITHY_CORE.dependency,
                    "HttpAuthSchemeEndpointRuleSet",
                    Convention.HAS_MIDDLEWARE)
                .withAdditionalClientParams(httpAuthSchemeParametersProvider)
                .build(),
            RuntimeClientPlugin.builder()
                .inputConfig(Symbol.builder()
                    .namespace(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_MODULE, "/")
                    .name("HttpAuthSchemeInputConfig")
                    .putProperty("typeOnly", true)
                    .build())
                .resolvedConfig(Symbol.builder()
                    .namespace(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_MODULE, "/")
                    .name("HttpAuthSchemeResolvedConfig")
                    .putProperty("typeOnly", true)
                    .build())
                .resolveFunction(Symbol.builder()
                    .namespace(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_MODULE, "/")
                    .name("resolveHttpAuthSchemeConfig")
                    .build())
                .build()
        );
    }

    @Override
    public void customize(TypeScriptCodegenContext codegenContext) {
        if (!codegenContext.settings().generateClient()
            || codegenContext.settings().useLegacyAuth()
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
            TopDownIndex topDownIndex = TopDownIndex.of(codegenContext.model());
            Map<ShapeId, HttpAuthScheme> httpAuthSchemes =
                AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(serviceShape, serviceIndex, authIndex, topDownIndex);
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

    /**
     * Writes the httpAuthSchemeParametersProvider for input to middleware additional parameters.
     * Example:
     * ```typescript
     * defaultWeatherHttpAuthSchemeParametersProvider;
     * ```
     */
    private static void httpAuthSchemeParametersProvider(TypeScriptWriter w,
                                                         ClientBodyExtraCodeSection clientBodySection) {
        String httpAuthSchemeParametersProviderName = "default"
            + CodegenUtils.getServiceName(
            clientBodySection.getSettings(),
            clientBodySection.getModel(),
            clientBodySection.getSymbolProvider()
        )
            + "HttpAuthSchemeParametersProvider";
        w.addImport(httpAuthSchemeParametersProviderName, null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
        w.writeInline(httpAuthSchemeParametersProviderName);
    }

    /**
     * Writes the identityProviderConfigProvider for input to middleware additional parameters.
     * Example:
     * ```typescript
     * async (config: WeatherClientResolvedConfig) => new DefaultIdentityProviderConfig({
     *   "aws.auth#sigv4": config.credentials,
     *   "smithy.api#httpApiKeyAuth": config.apiKey,
     *   "smithy.api#httpBearerAuth": config.token,
     * })
     * ```
     */
    private static void identityProviderConfigProvider(TypeScriptWriter w,
                                                       ClientBodyExtraCodeSection s) {
        w.addDependency(TypeScriptDependency.SMITHY_CORE);
        w.addImport("DefaultIdentityProviderConfig", null, TypeScriptDependency.SMITHY_CORE);
        w.openBlock("""
                        async (config: $LResolvedConfig) => \
                        new DefaultIdentityProviderConfig({""", "})",
            s.getSymbolProvider().toSymbol(s.getService()).getName(),
            () -> {
                SupportedHttpAuthSchemesIndex authIndex = new SupportedHttpAuthSchemesIndex(
                    s.getIntegrations(),
                    s.getModel(),
                    s.getSettings());
                ServiceIndex serviceIndex = ServiceIndex.of(s.getModel());
                TopDownIndex topDownIndex = TopDownIndex.of(s.getModel());
                Map<ShapeId, HttpAuthScheme> httpAuthSchemes = AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(
                    s.getService(), serviceIndex, authIndex, topDownIndex);
                for (HttpAuthScheme scheme : httpAuthSchemes.values()) {
                    if (scheme == null) {
                        continue;
                    }
                    for (ConfigField configField : scheme.getConfigFields()) {
                        if (configField.type().equals(ConfigField.Type.MAIN)) {
                            w.writeInline(
                                "$S: config.$L,",
                                scheme.getSchemeId().toString(),
                                configField.name()
                            );
                        }
                    }
                }
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
        w.writeDocs("@public");
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

        w.addTypeImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);
        w.writeDocs("""
            A comma-separated list of case-sensitive auth scheme names.
            An auth scheme name is a fully qualified auth scheme ID with the namespace prefix trimmed.
            For example, the auth scheme with ID aws.auth#sigv4 is named sigv4.
            @public""");
        w.write("authSchemePreference?: string[] | Provider<string[]>;\n");

        w.addTypeImport("HttpAuthScheme", null, TypeScriptDependency.SMITHY_TYPES);
        w.writeDocs("""
            Configuration of HttpAuthSchemes for a client which provides \
            default identity providers and signers per auth scheme.
            @internal""");
        w.write("httpAuthSchemes?: HttpAuthScheme[];\n");

        String httpAuthSchemeProviderName = serviceName + "HttpAuthSchemeProvider";
        w.writeDocs("""
            Configuration of an HttpAuthSchemeProvider for a client which \
            resolves which HttpAuthScheme to use.
            @internal""");
        w.write("httpAuthSchemeProvider?: $L;\n", httpAuthSchemeProviderName);

        for (ConfigField configField : configFields.values()) {
            if (configField.configFieldWriter().isPresent()) {
                configField.docs().ifPresent(docs -> w.writeDocs(() -> w.write("$C", docs)));
                w.write("$L?: $T;", configField.name(), configField.inputType());
            }
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

        w.addTypeImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);
        w.writeDocs("""
            A comma-separated list of case-sensitive auth scheme names.
            An auth scheme name is a fully qualified auth scheme ID with the namespace prefix trimmed.
            For example, the auth scheme with ID aws.auth#sigv4 is named sigv4.
            @public""");
        w.write("readonly authSchemePreference: Provider<string[]>;\n");

        w.addTypeImport("HttpAuthScheme", null, TypeScriptDependency.SMITHY_TYPES);
        w.writeDocs("""
            Configuration of HttpAuthSchemes for a client which provides \
            default identity providers and signers per auth scheme.
            @internal""");
        w.write("readonly httpAuthSchemes: HttpAuthScheme[];\n");

        String httpAuthSchemeProviderName = serviceName + "HttpAuthSchemeProvider";
        w.writeDocs("""
            Configuration of an HttpAuthSchemeProvider for a client which \
            resolves which HttpAuthScheme to use.
            @internal""");
        w.write("readonly httpAuthSchemeProvider: $L;\n", httpAuthSchemeProviderName);
        for (ConfigField configField : configFields.values()) {
            if (configField.configFieldWriter().isPresent()) {
                configField.docs().ifPresent(docs -> w.writeDocs(() -> w.write("$C", docs)));
                w.write("readonly $L?: $T;", configField.name(), configField.resolvedType());
            }
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
      return Object.assign(config, {
        credentials,
        region,
        apiKey,
        token,
      }) as HttpAuthSchemeResolvedConfig;
    };
    */
    private void generateResolveHttpAuthSchemeConfigFunction(
        TypeScriptWriter w,
        ResolveHttpAuthSchemeConfigFunctionCodeSection s
    ) {
        w.pushState(s);
        Map<String, ConfigField> configFields = s.getConfigFields();
        Map<Symbol, ResolveConfigFunction> resolveConfigFunctions = s.getResolveConfigFunctions();
        Map<Symbol, ResolveConfigFunction> previousResolvedFunctions = resolveConfigFunctions.entrySet().stream()
            .filter(e -> e.getValue().previouslyResolved().isPresent())
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        w.writeDocs("@internal");
        w.writeInline("""
            export const resolveHttpAuthSchemeConfig = <T>(config: T & HttpAuthSchemeInputConfig""");
        if (!previousResolvedFunctions.isEmpty()) {
            w.writeInline(" & ");
            Iterator<ResolveConfigFunction> iter = previousResolvedFunctions.values().iterator();
            while (iter.hasNext()) {
                ResolveConfigFunction entry = iter.next();
                w.writeInline("$T", entry.previouslyResolved().get());
                if (iter.hasNext()) {
                    w.writeInline(" & ");
                }
            }
        }
        w.write("""
            ): T & HttpAuthSchemeResolvedConfig => {""");
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
            configField.configFieldWriter().ifPresent(cfw -> cfw.accept(w, configField));
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
        Integer i = 0;
        String configName = "config";
        for (ResolveConfigFunction resolveConfigFunction : resolveConfigFunctions.values()) {
            w.openBlock(
                "const config_$L = $T($L",
                ");",
                i,
                resolveConfigFunction.resolveConfigFunction(),
                configName,
                () -> {
                    for (String addArg : resolveConfigFunction.addArgs()) {
                        w.writeInline(", $L", addArg);
                    }
                }
            );
            configName = "config_" + i;
            i++;
        }
        w.write("return Object.assign(");
        w.indent();
        w.write("$L, {", configName);
        w.addImport("normalizeProvider", null, TypeScriptDependency.UTIL_MIDDLEWARE);
        w.write("authSchemePreference: normalizeProvider(config.authSchemePreference ?? []),");
        for (ConfigField configField : configFields.values()) {
            if (configField.configFieldWriter().isPresent()) {
                w.write("$L,", configField.name());
            }
        }
        w.dedent();
        w.write("}) as T & HttpAuthSchemeResolvedConfig;");
        w.popState();
        w.dedent();
        w.write("};");
        w.popState();
    }
}
