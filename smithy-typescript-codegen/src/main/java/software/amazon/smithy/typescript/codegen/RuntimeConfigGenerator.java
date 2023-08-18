/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package software.amazon.smithy.typescript.codegen;

import java.nio.file.Paths;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.TreeMap;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import software.amazon.smithy.build.SmithyBuildException;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.typescript.codegen.auth.AuthUtils;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthSchemeProviderGenerator;
import software.amazon.smithy.typescript.codegen.auth.http.SupportedHttpAuthSchemesIndex;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates runtime configuration files, files that are used to
 * supply different default values based on the targeted language
 * environment of the SDK (e.g., Node vs Browser).
 */
@SmithyInternalApi
final class RuntimeConfigGenerator {

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final TypeScriptDelegator delegator;
    private final List<TypeScriptIntegration> integrations;
    private final ApplicationProtocol applicationProtocol;
    private final Map<String, Consumer<TypeScriptWriter>> nodeRuntimeConfigDefaults = MapUtils.of(
            "requestHandler", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
                writer.addImport("NodeHttpHandler", "RequestHandler",
                        TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
                writer.write("new RequestHandler(defaultConfigProvider)");
            },
            "sha256", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_HASH_NODE);
                writer.addImport("Hash", null, TypeScriptDependency.AWS_SDK_HASH_NODE);
                writer.write("Hash.bind(null, \"sha256\")");
            },
            "bodyLengthChecker", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_BODY_LENGTH_NODE);
                writer.addImport("calculateBodyLength", null, TypeScriptDependency.AWS_SDK_UTIL_BODY_LENGTH_NODE);
                writer.write("calculateBodyLength");
            },
            "streamCollector", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
                writer.addImport("streamCollector", null, TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
                writer.write("streamCollector");
            }
    );
    private final Map<String, Consumer<TypeScriptWriter>> browserRuntimeConfigDefaults = MapUtils.of(
            "requestHandler", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_FETCH_HTTP_HANDLER);
                writer.addImport("FetchHttpHandler", "RequestHandler",
                        TypeScriptDependency.AWS_SDK_FETCH_HTTP_HANDLER);
                writer.write("new RequestHandler(defaultConfigProvider)");
            },
            "sha256", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_CRYPTO_SHA256_BROWSER);
                writer.addImport("Sha256", null, TypeScriptDependency.AWS_CRYPTO_SHA256_BROWSER);
                writer.write("Sha256");
            },
            "bodyLengthChecker", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_BODY_LENGTH_BROWSER);
                writer.addImport("calculateBodyLength", null, TypeScriptDependency.AWS_SDK_UTIL_BODY_LENGTH_BROWSER);
                writer.write("calculateBodyLength");
            },
            "streamCollector", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_FETCH_HTTP_HANDLER);
                writer.addImport("streamCollector", null,
                        TypeScriptDependency.AWS_SDK_FETCH_HTTP_HANDLER);
                writer.write("streamCollector");
            }
    );
    private final Map<String, Consumer<TypeScriptWriter>> reactNativeRuntimeConfigDefaults = MapUtils.of(
            "sha256", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_CRYPTO_SHA256_JS);
                writer.addImport("Sha256", null, TypeScriptDependency.AWS_CRYPTO_SHA256_JS);
                writer.write("Sha256");
            }
    );
    private final Map<String, Consumer<TypeScriptWriter>> sharedRuntimeConfigDefaults = MapUtils.of(
            "base64Decoder", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_BASE64);
                writer.addImport("fromBase64", null,
                        TypeScriptDependency.AWS_SDK_UTIL_BASE64);
                writer.write("fromBase64");
            },
            "base64Encoder", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_BASE64);
                writer.addImport("toBase64", null,
                        TypeScriptDependency.AWS_SDK_UTIL_BASE64);
                writer.write("toBase64");
            },
            "disableHostPrefix", writer -> {
                writer.write("false");
            },
            "urlParser", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_URL_PARSER);
                writer.addImport("parseUrl", null,
                        TypeScriptDependency.AWS_SDK_URL_PARSER);
                writer.write("parseUrl");
            },
            "utf8Decoder", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_UTF8);
                writer.addImport("fromUtf8", null,
                        TypeScriptDependency.AWS_SDK_UTIL_UTF8);
                writer.write("fromUtf8");
            },
            "utf8Encoder", writer -> {
                writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_UTF8);
                writer.addImport("toUtf8", null,
                        TypeScriptDependency.AWS_SDK_UTIL_UTF8);
                writer.write("toUtf8");
            },
            "extensions", writer -> {
                writer.write("[]");
            }
    );

    RuntimeConfigGenerator(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptDelegator delegator,
            List<TypeScriptIntegration> integrations,
            ApplicationProtocol applicationProtocol
    ) {
        this.settings = settings;
        this.model = model;
        this.service = settings.getService(model);
        this.symbolProvider = symbolProvider;
        this.delegator = delegator;
        this.integrations = integrations;
        this.applicationProtocol = applicationProtocol;
    }

    void generate(LanguageTarget target) {
        String template = TypeScriptUtils.loadResourceAsString(target.getTemplateFileName());
        String contents = template
                .replace("${clientModuleName}", symbolProvider.toSymbol(service).getNamespace()
                    .replaceFirst(CodegenUtils.SOURCE_FOLDER + "/", ""))
                .replace("${clientConfigName}", symbolProvider.toSymbol(service).getName() + "Config")
                .replace("${apiVersion}", service.getVersion())
                .replace("$", "$$") // sanitize template place holders.
                .replace("$${customizations}", "${L@customizations}");

        delegator.useFileWriter(target.getTargetFilename(), writer -> {
            // Inject customizations into the ~template.
            writer.indent().onSection("customizations", original -> {
                // Start with defaults, use a TreeMap for keeping entries sorted.
                Map<String, Consumer<TypeScriptWriter>> configs =
                        new TreeMap<>(getDefaultRuntimeConfigs(target));
                // Add any integration supplied runtime config writers.
                for (TypeScriptIntegration integration : integrations) {
                    configs.putAll(integration.getRuntimeConfigWriters(settings, model, symbolProvider, target));
                }
                // feat(experimentalIdentityAndAuth): add config writers for httpAuthScheme and httpAuthSchemes
                // Needs a separate integration point since not all the information is accessible in
                // {@link TypeScriptIntegration#getRuntimeConfigWriters()}
                if (applicationProtocol.isHttpProtocol() && settings.getExperimentalIdentityAndAuth()) {
                    generateHttpAuthSchemeConfig(configs, writer, target);
                }
                int indentation = target.equals(LanguageTarget.SHARED) ? 1 : 2;
                configs.forEach((key, value) -> {
                    writer.indent(indentation).disableNewlines().openBlock("$1L: config?.$1L ?? ", ",\n", key,
                        () -> {
                            value.accept(writer);
                        });
                    writer.dedent(indentation);
                });
            });
            writer.dedent();
            writer.write(contents, "");
        });
    }

    private void generateHttpAuthSchemeConfig(
        Map<String, Consumer<TypeScriptWriter>> configs,
        TypeScriptWriter writer,
        LanguageTarget target
    ) {
        // feat(experimentalIdentityAndAuth): gather HttpAuthSchemes to generate
        SupportedHttpAuthSchemesIndex index = new SupportedHttpAuthSchemesIndex(integrations);
        ServiceIndex serviceIndex = ServiceIndex.of(model);
        Map<ShapeId, Trait> authSchemeTraits = serviceIndex.getAuthSchemes(service);
        Map<ShapeId, HttpAuthScheme> authSchemes = authSchemeTraits.entrySet().stream()
            .filter(entry -> index.getHttpAuthScheme(entry.getKey()) != null)
            .collect(Collectors.toMap(
                entry -> entry.getKey(),
                entry -> index.getHttpAuthScheme(entry.getKey())));
        // feat(experimentalIdentityAndAuth): can be removed after changing to NO_AUTH_AWARE schemes
        // The default set of HttpAuthSchemes is @smithy.api#noAuth on the shared runtime config
        authSchemes.put(AuthUtils.NO_AUTH_ID, index.getHttpAuthScheme(AuthUtils.NO_AUTH_ID));
        boolean shouldGenerateHttpAuthSchemes = index.getSupportedHttpAuthSchemes().values().stream().anyMatch(value ->
            // If either an default identity or signer is configured for the target, generate auth schemes
            value.getDefaultIdentityProviders().containsKey(target) || value.getDefaultSigners().containsKey(target));
        if (!shouldGenerateHttpAuthSchemes) {
            return;
        }
        // feat(experimentalIdentityAndAuth): write the default imported HttpAuthSchemeProvider
        configs.put("httpAuthSchemeProvider", w -> {
            String providerName = "default" + service.toShapeId().getName() + "HttpAuthSchemeProvider";
            w.addRelativeImport(providerName, null, Paths.get(".", CodegenUtils.SOURCE_FOLDER,
                HttpAuthSchemeProviderGenerator.HTTP_AUTH_FOLDER,
                HttpAuthSchemeProviderGenerator.HTTP_AUTH_SCHEME_RESOLVER_MODULE));
            w.write(providerName);
        });
        // feat(experimentalIdentityAndAuth): write the default IdentityProviderConfiguration with configured
        // HttpAuthSchemes
        configs.put("httpAuthSchemes", w -> {
            w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
            w.addImport("DefaultIdentityProviderConfiguration", null,
                TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
            w.openBlock("new DefaultIdentityProviderConfiguration([", "])", () -> {
                Iterator<Entry<ShapeId, HttpAuthScheme>> iter = authSchemes.entrySet().iterator();
                while (iter.hasNext()) {
                    Entry<ShapeId, HttpAuthScheme> entry = iter.next();
                    // Default IdentityProvider or HttpSigner, otherwise write {@code never} to force a TypeScript
                    // compilation failure.
                    Consumer<TypeScriptWriter> defaultIdentityProvider = entry.getValue()
                        .getDefaultIdentityProviders()
                        .getOrDefault(target, AuthUtils.DEFAULT_NEVER_WRITER);
                    Consumer<TypeScriptWriter> defaultSigner = entry.getValue()
                        .getDefaultSigners()
                        .getOrDefault(target, AuthUtils.DEFAULT_NEVER_WRITER);
                    w.write("""
                        {
                          schemeId: $S,
                          identityProvider: $C,
                          signer: $C,
                        }""",
                        entry.getKey(),
                        defaultIdentityProvider,
                        defaultSigner);
                    if (iter.hasNext()) {
                        w.writeInline(", ");
                    }
                }
            });
        });
    }

    private Map<String, Consumer<TypeScriptWriter>> getDefaultRuntimeConfigs(LanguageTarget target) {
        switch (target) {
            case NODE:
                return nodeRuntimeConfigDefaults;
            case BROWSER:
                return browserRuntimeConfigDefaults;
            case REACT_NATIVE:
                return reactNativeRuntimeConfigDefaults;
            case SHARED:
                return sharedRuntimeConfigDefaults;
            default:
                throw new SmithyBuildException("Unknown target: " + target);
        }
    }
}
