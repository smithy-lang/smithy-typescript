/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.List;
import java.util.Map;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.ConfigField;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenContext;
import software.amazon.smithy.typescript.codegen.TypeScriptDelegator;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.auth.AuthUtils;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.typescript.codegen.auth.http.SupportedHttpAuthSchemesIndex;
import software.amazon.smithy.typescript.codegen.extensions.ExtensionConfigurationInterface;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.StringUtils;

/**
 * Adds {@link HttpAuthExtensionConfigurationInterface} to a client.
 *
 * This is the experimental behavior for `experimentalIdentityAndAuth`.
 */
@SmithyInternalApi
public class HttpAuthRuntimeExtensionIntegration implements TypeScriptIntegration {

    /**
     * Integration should only be used if `experimentalIdentityAndAuth` flag is true.
     */
    @Override
    public boolean matchesSettings(TypeScriptSettings settings) {
        return settings.getExperimentalIdentityAndAuth();
    }

    @Override
    public List<ExtensionConfigurationInterface> getExtensionConfigurationInterfaces() {
        return List.of(new HttpAuthExtensionConfigurationInterface());
    }

    @Override
    public void customize(TypeScriptCodegenContext codegenContext) {
        if (!codegenContext.settings().generateClient()) {
            return;
        }
        TypeScriptDelegator delegator = codegenContext.writerDelegator();
        SupportedHttpAuthSchemesIndex authIndex =
            new SupportedHttpAuthSchemesIndex(codegenContext.integrations());
        ServiceIndex serviceIndex = ServiceIndex.of(codegenContext.model());
        String serviceName = CodegenUtils.getServiceName(
            codegenContext.settings(), codegenContext.model(), codegenContext.symbolProvider());
        ServiceShape serviceShape = codegenContext.settings().getService(codegenContext.model());
        Map<ShapeId, HttpAuthScheme> effectiveAuthSchemes =
            AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(serviceShape, serviceIndex, authIndex);
        Map<String, ConfigField> configFields = AuthUtils.collectConfigFields(effectiveAuthSchemes.values());

        generateHttpAuthExtensionConfigurationInterface(
            delegator, configFields, serviceName);
        generateHttpAuthExtensionRuntimeConfigType(
            delegator, configFields, serviceName);
        generateGetHttpAuthExtensionConfigurationFunction(
            delegator, configFields, serviceName);
        generateResolveHttpAuthRuntimeConfigFunction(
            delegator, configFields, serviceName);
    }

    /*
    import {
      ApiKeyIdentity,
      ApiKeyIdentityProvider,
      AwsCredentialsIdentity,
      AwsCredentialIdentityProvider,
      HttpAuthScheme,
      TokenIdentity,
      TokenIdentityProvider
    } from "@smithy/types";

    import {
      WeatherHttpAuthSchemeProvider
    } from "./httpAuthSchemeProvider";

    // ...

    export interface HttpAuthExtensionConfiguration {
      setHttpAuthScheme(httpAuthScheme: HttpAuthScheme): void;
      httpAuthSchemes(): HttpAuthScheme[];

      setHttpAuthSchemeProvider(httpAuthSchemeProvider: WeatherHttpAuthSchemeProvider): void;
      httpAuthSchemeProvider(): WeatherHttpAuthSchemeProvider;

      // @aws.auth#sigv4
      setCredentials(credentials: AwsCredentialsIdentity | AwsCredentialIdentityProvider): void;
      credentials(): AwsCredentialsIdentity | AwsCredentialIdentityProvider | undefined;

      // @httpApiKeyAuth
      setApiKey(apiKey: ApiKeyIdentity | ApiKeyIdentityProvider): void;
      apiKey(): ApiKeyIdentity | ApiKeyIdentityProvider | undefined;

      // @httpBearerAuth
      setToken(token: TokenIdentity| TokenIdentityProvider): void;
      token(): TokenIdentity | TokenIdentityProvider | undefined;
    }
    */
    private void generateHttpAuthExtensionConfigurationInterface(
        TypeScriptDelegator delegator,
        Map<String, ConfigField> configFields,
        String serviceName
    ) {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_PATH, w -> {
            w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.openBlock("""
                /**
                 * @internal
                 */
                export interface HttpAuthExtensionConfiguration {""", "}",
                () -> {
                w.addImport("HttpAuthScheme", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.write("setHttpAuthScheme(httpAuthScheme: HttpAuthScheme): void;");
                w.write("httpAuthSchemes(): HttpAuthScheme[];");

                w.addImport(serviceName + "HttpAuthSchemeProvider", null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
                w.write("setHttpAuthSchemeProvider(httpAuthSchemeProvider: $LHttpAuthSchemeProvider): void;",
                    serviceName);
                w.write("httpAuthSchemeProvider(): $LHttpAuthSchemeProvider;", serviceName);

                for (ConfigField configField : configFields.values()) {
                    if (configField.type().equals(ConfigField.Type.MAIN)) {
                        String capitalizedName = StringUtils.capitalize(configField.name());
                        w.write("set$L($L: $C): void;", capitalizedName, configField.name(), configField.inputType());
                        w.write("$L(): $C | undefined;", configField.name(), configField.inputType());
                    }
                }
            });
        });
    }

    /*
    import {
      ApiKeyIdentity,
      ApiKeyIdentityProvider,
      AwsCredentialsIdentity,
      AwsCredentialIdentityProvider,
      HttpAuthScheme,
      TokenIdentity,
      TokenIdentityProvider
    } from "@smithy/types";

    import {
      WeatherHttpAuthSchemeProvider
    } from "./httpAuthSchemeProvider";

    // ...

    export type HttpAuthRuntimeConfig = Partial<{
      httpAuthSchemes: HttpAuthScheme[];
      httpAuthSchemeProvider: WeatherHttpAuthSchemeProvider;
      // @aws.auth#sigv4
      credentials: AwsCredentialsIdentity | AwsCredentialIdentityProvider;
      // @httpApiKeyAuth
      apiKey: ApiKeyIdentity | ApiKeyIdentityProvider;
      // @httpBearerAuth
      token: TokenIdentity | TokenIdentityProvider;
    }>;
    */
    private void generateHttpAuthExtensionRuntimeConfigType(
        TypeScriptDelegator delegator,
        Map<String, ConfigField> configFields,
        String serviceName
    ) {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_PATH, w -> {
            w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.openBlock("""
                /**
                 * @internal
                 */
                export type HttpAuthRuntimeConfig = Partial<{""", "}>;",
                () -> {
                w.addImport("HttpAuthScheme", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.write("httpAuthSchemes: HttpAuthScheme[];");
                w.addImport(serviceName + "HttpAuthSchemeProvider", null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
                w.write("httpAuthSchemeProvider: $LHttpAuthSchemeProvider;", serviceName);
                for (ConfigField configField : configFields.values()) {
                    if (configField.type().equals(ConfigField.Type.MAIN)) {
                        w.write("$L: $C;", configField.name(), configField.inputType());
                    }
                }
            });
        });
    }

    /*
    import {
      ApiKeyIdentity,
      ApiKeyIdentityProvider,
      AwsCredentialsIdentity,
      AwsCredentialIdentityProvider,
      HttpAuthScheme,
      TokenIdentity,
      TokenIdentityProvider
    } from "@smithy/types";

    import {
      WeatherHttpAuthSchemeProvider
    } from "./httpAuthSchemeProvider";

    // ...

    export const getHttpAuthExtensionConfiguration =
      (runtimeConfig: HttpAuthRuntimeConfig): HttpAuthExtensionConfiguration => {
      let _httpAuthSchemes = runtimeConfig.httpAuthSchemes!;
      let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider!;
      let _credentials = runtimeConfig.credentials;
      let _apiKey = runtimeConfig.apiKey;
      let _token = runtimeConfig.token;
      return {
        setHttpAuthScheme(httpAuthScheme: HttpAuthScheme): void {
          const index = _httpAuthSchemes.findIndex(scheme => scheme.schemeId === httpAuthScheme.schemeId);
          if (index === -1) {
            _httpAuthSchemes.push(httpAuthScheme);
          } else {
            _httpAuthSchemes.splice(index, 1, httpAuthScheme);
          }
        },
        httpAuthSchemes(): HttpAuthScheme[] {
          return _httpAuthSchemes;
        },
        setHttpAuthSchemeProvider(httpAuthSchemeProvider: WeatherHttpAuthSchemeProvider): void {
          _httpAuthSchemeProvider = httpAuthSchemeProvider;
        },
        httpAuthSchemeProvider(): WeatherHttpAuthSchemeProvider {
          return _httpAuthSchemeProvider;
        },
        // Dependent on auth traits
        setCredentials(credentials: AwsCredentialsIdentity | AwsCredentialIdentityProvider): void {
          _credentials = credentials;
        },
        credentials(): AwsCredentialsIdentity | AwsCredentialIdentityProvider | undefined {
          return _credentials;
        },
        setApiKey(apiKey: ApiKeyIdentity | ApiKeyIdentityProvider): void {
          _apiKey = apiKey;
        },
        apiKey(): ApiKeyIdentity | ApiKeyIdentityProvider | undefined {
          return _apiKey;
        },
        setToken(token: TokenIdentity | TokenIdentityProvider): void {
          _token = token;
        },
        token(): TokenIdentity | TokenIdentityProvider | undefined {
          return _token;
        },
      };
    };
    */
    private void generateGetHttpAuthExtensionConfigurationFunction(
        TypeScriptDelegator delegator,
        Map<String, ConfigField> configFields,
        String serviceName
    ) {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_PATH, w -> {
            w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.openBlock("""
                /**
                 * @internal
                 */
                export const getHttpAuthExtensionConfiguration = (runtimeConfig: HttpAuthRuntimeConfig): \
                HttpAuthExtensionConfiguration => {""", "};",
                () -> {
                w.addImport("HttpAuthScheme", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.write("let _httpAuthSchemes = runtimeConfig.httpAuthSchemes!;");
                w.addImport(serviceName + "HttpAuthSchemeProvider", null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
                w.write("let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider!;");
                for (ConfigField configField : configFields.values()) {
                    if (configField.type().equals(ConfigField.Type.MAIN)) {
                        w.write("let _$L = runtimeConfig.$L;", configField.name(), configField.name());
                    }
                }

                w.openBlock("return {", "}",
                () -> {
                    w.write("""
                        setHttpAuthScheme(httpAuthScheme: HttpAuthScheme): void {
                          const index = _httpAuthSchemes.findIndex(scheme => \
                        scheme.schemeId === httpAuthScheme.schemeId);
                          if (index === -1) {
                            _httpAuthSchemes.push(httpAuthScheme);
                          } else {
                            _httpAuthSchemes.splice(index, 1, httpAuthScheme);
                          }
                        },
                        httpAuthSchemes(): HttpAuthScheme[] {
                          return _httpAuthSchemes;
                        },""");
                    w.write("""
                        setHttpAuthSchemeProvider(httpAuthSchemeProvider: $LHttpAuthSchemeProvider): void {
                          _httpAuthSchemeProvider = httpAuthSchemeProvider;
                        },
                        httpAuthSchemeProvider(): $LHttpAuthSchemeProvider {
                          return _httpAuthSchemeProvider;
                        },""", serviceName, serviceName);
                    for (ConfigField configField : configFields.values()) {
                        if (configField.type().equals(ConfigField.Type.MAIN)) {
                            String capitalizedName = StringUtils.capitalize(configField.name());
                            w.write("""
                                set$L($L: $C): void {
                                  _$L = $L;
                                },
                                $L(): $C | undefined {
                                  return _$L;
                                },""",
                                capitalizedName, configField.name(), configField.inputType(),
                                configField.name(), configField.name(),
                                configField.name(), configField.inputType(),
                                configField.name());
                        }
                    }
                });
            });
        });
    }

    /*
    export const resolveHttpAuthRuntimeConfig =
      (config: HttpAuthExtensionConfiguration): HttpAuthRuntimeConfig => {
      return {
        httpAuthSchemes: config.httpAuthSchemes(),
        httpAuthSchemeProvider: config.httpAuthSchemeProvider(),
        // Dependent on auth traits
        credentials: config.credentials(),
        apiKey: config.apiKey(),
        token: config.token(),
      };
    };
    */
    private void generateResolveHttpAuthRuntimeConfigFunction(
        TypeScriptDelegator delegator,
        Map<String, ConfigField> configFields,
        String serviceName
    ) {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_PATH, w -> {
            w.openBlock("""
                /**
                 * @internal
                 */
                export const resolveHttpAuthRuntimeConfig = (config: HttpAuthExtensionConfiguration): \
                HttpAuthRuntimeConfig => {""", "};",
                () -> {
                w.openBlock("return {", "};", () -> {
                    w.write("httpAuthSchemes: config.httpAuthSchemes(),");
                    w.write("httpAuthSchemeProvider: config.httpAuthSchemeProvider(),");
                    for (ConfigField configField : configFields.values()) {
                        if (configField.type().equals(ConfigField.Type.MAIN)) {
                            w.write("$L: config.$L(),", configField.name(), configField.name());
                        }
                    }
                });
            });
        });
    }
}
