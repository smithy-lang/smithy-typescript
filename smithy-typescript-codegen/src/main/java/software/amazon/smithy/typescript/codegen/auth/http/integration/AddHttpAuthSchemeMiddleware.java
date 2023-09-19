/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_MIDDLEWARE;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
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
                .withConventions(
                    TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH.dependency,
                    "HttpAuthScheme",
                    HAS_MIDDLEWARE)
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
    public void addConfigInterfaceFields(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer
    ) {
        writer.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
        writer.addImport("HttpAuthScheme", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
        writer.writeDocs("""
            experimentalIdentityAndAuth: Configuration of HttpAuthSchemes for a client which provides \
            default identity providers and signers per auth scheme.
            @internal""");
        writer.write("httpAuthSchemes?: HttpAuthScheme[];\n");

        String httpAuthSchemeProviderName = CodegenUtils.getServiceName(settings, model, symbolProvider)
            + "HttpAuthSchemeProvider";
        writer.addImport(httpAuthSchemeProviderName, null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
        writer.writeDocs("""
            experimentalIdentityAndAuth: Configuration of an HttpAuthSchemeProvider for a client which \
            resolves which HttpAuthScheme to use.
            @internal""");
        writer.write("httpAuthSchemeProvider?: $L;\n", httpAuthSchemeProviderName);
    }

    @Override
    public void customize(TypeScriptCodegenContext codegenContext) {
        if (!codegenContext.settings().generateClient()) {
            return;
        }
        codegenContext.writerDelegator().useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            SupportedHttpAuthSchemesIndex authIndex = new SupportedHttpAuthSchemesIndex(codegenContext.integrations());
            String service = CodegenUtils.getServiceName(
                codegenContext.settings(), codegenContext.model(), codegenContext.symbolProvider());
            ServiceShape serviceShape = codegenContext.settings().getService(codegenContext.model());
            ServiceIndex serviceIndex = ServiceIndex.of(codegenContext.model());
            Map<ShapeId, HttpAuthScheme> httpAuthSchemes
                = AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(serviceShape, serviceIndex, authIndex);
            Map<String, ConfigField> configFields =
                AuthUtils.collectConfigFields(httpAuthSchemes.values());

            generateHttpAuthSchemeInputConfigInterface(w, configFields);
            generateHttpAuthSchemeResolvedConfigInterface(w, configFields, service);
            generateResolveHttpAuthSchemeConfigFunction(w, configFields, httpAuthSchemes, authIndex, service);
        });
    }

    /*
    export interface HttpAuthSchemeInputConfig {
      apiKey?: ApiKeyIdentity | ApiKeyIdentityProvider;

      token?: TokenIdentity | TokenIdentityProvider;

      region?: string | __Provider<string>;

      credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
    }
    */
    private void generateHttpAuthSchemeInputConfigInterface(
        TypeScriptWriter w,
        Map<String, ConfigField> configFields
    ) {
        w.openBlock("""
            /**
             * @internal
             */
            export interface HttpAuthSchemeInputConfig {""", "}\n", () -> {
                for (ConfigField configField : configFields.values()) {
                    w.writeDocs(() -> w.write("$C", configField.docs()));
                    w.write("$L?: $C;", configField.name(), configField.inputType());
                }
            });
    }

    /*
    export interface HttpAuthSchemeResolvedConfig {
      readonly apiKey?: ApiKeyIdentityProvider;

      readonly token?: TokenIdentityProvider;

      readonly region?: __Provider<string>;

      readonly credentials?: AwsCredentialIdentityProvider;

      readonly httpAuthSchemeParametersProvider: WeatherHttpAuthSchemeParametersProvider;

      readonly identityProviderConfig: IdentityProviderConfig;
    }
    */
    private void generateHttpAuthSchemeResolvedConfigInterface(
        TypeScriptWriter w,
        Map<String, ConfigField> configFields,
        String service
    ) {
        w.openBlock("""
            /**
             * @internal
             */
            export interface HttpAuthSchemeResolvedConfig {""", "}\n", () -> {
                for (ConfigField configField : configFields.values()) {
                    w.writeDocs(() -> w.write("$C", configField.docs()));
                    w.write("readonly $L?: $C;", configField.name(), configField.resolvedType());
                }
                w.writeDocs("""
                    experimentalIdentityAndAuth: provides parameters for HttpAuthSchemeProvider.
                    @internal""");
                w.write("readonly httpAuthSchemeParametersProvider: $LHttpAuthSchemeParametersProvider;",
                    service);

                w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.addImport("IdentityProviderConfig", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.writeDocs("""
                    experimentalIdentityAndAuth: abstraction around identity configuration fields
                    @internal""");
                w.write("readonly identityProviderConfig: IdentityProviderConfig;");
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
        httpAuthSchemeParametersProvider: defaultWeatherHttpAuthSchemeParametersProvider,
        identityProviderConfig: new DefaultIdentityProviderConfig({
          "aws.auth#sigv4": credentials,
          "smithy.api#httpApiKeyAuth": apiKey,
          "smithy.api#httpBearerAuth": token,
        }),
      };
    };
    */
    private void generateResolveHttpAuthSchemeConfigFunction(
        TypeScriptWriter w,
        Map<String, ConfigField> configFields,
        Map<ShapeId, HttpAuthScheme> httpAuthSchemes,
        SupportedHttpAuthSchemesIndex authIndex,
        String service
    ) {
        w.openBlock("""
            /**
             * @internal
             */
            export const resolveHttpAuthSchemeConfig = (config: HttpAuthSchemeInputConfig): \
            HttpAuthSchemeResolvedConfig => {""", "};", () -> {
                w.addDependency(TypeScriptDependency.UTIL_MIDDLEWARE);
                w.addImport("normalizeProvider", null, TypeScriptDependency.UTIL_MIDDLEWARE);
                w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.addImport("memoizeIdentityProvider", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.addImport("isIdentityExpired", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.addImport("doesIdentityRequireRefresh", null,
                    TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.addImport("DefaultIdentityProviderConfig", null,
                    TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                for (ConfigField configField : configFields.values()) {
                    if (configField.type().equals(ConfigField.Type.MAIN)) {
                        w.write("""
                            const $L = memoizeIdentityProvider(config.$L, isIdentityExpired, \
                            doesIdentityRequireRefresh);""",
                            configField.name(),
                            configField.name());
                    }
                    if (configField.type().equals(ConfigField.Type.AUXILIARY)) {
                        w.write("const $L = config.$L ? normalizeProvider(config.$L) : undefined;",
                            configField.name(),
                            configField.name(),
                            configField.name());
                    }
                }
                w.openBlock("return {", "};", () -> {
                    w.write("...config,");
                    for (ConfigField configField : configFields.values()) {
                        w.write("$L,", configField.name());
                    }
                    w.write("httpAuthSchemeParametersProvider: $T,",
                        authIndex.getDefaultHttpAuthSchemeParametersProvider()
                        .orElse(Symbol.builder()
                            .name("default" + service + "HttpAuthSchemeParametersProvider")
                            .build()));

                    w.openBlock("identityProviderConfig: new DefaultIdentityProviderConfig({", "}),", () -> {
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
                                        w.write("$S: $L,", scheme.getSchemeId().toString(), configField.name());
                                    }
                                }
                            }
                        }
                    });
                });
            });
    }
}
