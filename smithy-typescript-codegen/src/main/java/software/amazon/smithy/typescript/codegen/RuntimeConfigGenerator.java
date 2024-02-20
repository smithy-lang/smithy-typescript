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

import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Consumer;
import software.amazon.smithy.build.SmithyBuildException;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.auth.AuthUtils;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
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
                writer.write("RequestHandler.create(config.requestHandler ?? defaultConfigProvider)");
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
                writer.write("RequestHandler.create(config.requestHandler ?? defaultConfigProvider)");
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
                .replace("${", "$${") // sanitize template place holders.
                .replace("$${customizations}", "${L@customizations}")
                .replace("$${prepareCustomizations}", "${L@prepareCustomizations}");

        delegator.useFileWriter(target.getTargetFilename(), writer -> {
            // Inject customizations into the ~template.
            writer.onSection("prepareCustomizations", original -> {
                for (TypeScriptIntegration integration : integrations) {
                    integration.prepareCustomizations(writer, target, settings, model);
                }
            });
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
                    String defaultPrefix = "config?.$1L ?? ";
                    if (key.equals("requestHandler")) {
                        defaultPrefix = "";
                    }
                    writer
                        .indent(indentation)
                        .disableNewlines()
                        .openBlock(
                            "$1L: " + defaultPrefix, ",\n", key,
                            () -> {
                                value.accept(writer);
                            }
                        )
                        .dedent(indentation);
                });
            });
            writer.dedent();
            writer.write(contents, "", "");
        });
    }

    private void generateHttpAuthSchemeConfig(
        Map<String, Consumer<TypeScriptWriter>> configs,
        TypeScriptWriter writer,
        LanguageTarget target
    ) {
        SupportedHttpAuthSchemesIndex authIndex = new SupportedHttpAuthSchemesIndex(integrations, model, settings);

        // feat(experimentalIdentityAndAuth): write the default imported HttpAuthSchemeProvider
        if (target.equals(LanguageTarget.SHARED)) {
            configs.put("httpAuthSchemeProvider", w -> {
                w.write("$T", Symbol.builder()
                        .name("default"
                            + CodegenUtils.getServiceName(settings, model, symbolProvider)
                            + "HttpAuthSchemeProvider")
                        .namespace(AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY.getPackageName(), "/")
                        .build());
            });
        }

        // feat(experimentalIdentityAndAuth): gather HttpAuthSchemes to generate
        ServiceIndex serviceIndex = ServiceIndex.of(model);
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Map<ShapeId, HttpAuthScheme> allEffectiveHttpAuthSchemes =
            AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(service, serviceIndex, authIndex, topDownIndex);
        List<HttpAuthSchemeTarget> targetAuthSchemes = getHttpAuthSchemeTargets(target, allEffectiveHttpAuthSchemes);

        // Generate only if the "inherited" target is different than the current target
        List<HttpAuthSchemeTarget> inheritedAuthSchemes = Collections.emptyList();
        // Always generated the SHARED target
        if (target.equals(LanguageTarget.SHARED)) {
            // no-op
        // NODE and BROWSER inherit from SHARED
        } else if (target.equals(LanguageTarget.NODE) || target.equals(LanguageTarget.BROWSER)) {
            inheritedAuthSchemes = getHttpAuthSchemeTargets(LanguageTarget.SHARED, allEffectiveHttpAuthSchemes);
        // REACT_NATIVE inherits from BROWSER
        } else if (target.equals(LanguageTarget.REACT_NATIVE)) {
            inheritedAuthSchemes = getHttpAuthSchemeTargets(LanguageTarget.BROWSER, allEffectiveHttpAuthSchemes);
        } else {
            throw new CodegenException("Unhandled Language Target: " + target);
        }

        // If target and inherited auth schemes are equal, then don't generate target auth schemes.
        if (targetAuthSchemes.equals(inheritedAuthSchemes)) {
            return;
        }

        // feat(experimentalIdentityAndAuth): write the default httpAuthSchemes
        configs.put("httpAuthSchemes", w -> {
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.addImport("IdentityProviderConfig", null, TypeScriptDependency.SMITHY_TYPES);
            w.openBlock("[", "]", () -> {
                Iterator<HttpAuthSchemeTarget> iter = targetAuthSchemes.iterator();
                while (iter.hasNext()) {
                    HttpAuthSchemeTarget entry = iter.next();
                    if (entry.identityProvider == null) {
                        w.write("""
                            {
                              schemeId: $S,
                              identityProvider: (ipc: IdentityProviderConfig) =>
                                ipc.getIdentityProvider($S),
                              signer: $C,
                            }""",
                            entry.httpAuthScheme.getSchemeId(),
                            entry.httpAuthScheme.getSchemeId(),
                            entry.signer);
                    } else {
                        w.write("""
                            {
                              schemeId: $S,
                              identityProvider: (ipc: IdentityProviderConfig) =>
                                ipc.getIdentityProvider($S) || ($C),
                              signer: $C,
                            }""",
                            entry.httpAuthScheme.getSchemeId(),
                            entry.httpAuthScheme.getSchemeId(),
                            entry.identityProvider,
                            entry.signer);
                    }
                    if (iter.hasNext()) {
                        w.writeInline(", ");
                    }
                }
            });
        });
    }

    private static class HttpAuthSchemeTarget {
        public HttpAuthScheme httpAuthScheme;
        public Consumer<TypeScriptWriter> identityProvider;
        public Consumer<TypeScriptWriter> signer;

        HttpAuthSchemeTarget(
            HttpAuthScheme httpAuthScheme,
            Consumer<TypeScriptWriter> identityProvider,
            Consumer<TypeScriptWriter> signer
        ) {
            this.httpAuthScheme = httpAuthScheme;
            this.identityProvider = identityProvider;
            this.signer = signer;
        }

        @Override
        public boolean equals(Object other) {
            if (!(other instanceof HttpAuthSchemeTarget)) {
                return false;
            }
            HttpAuthSchemeTarget o = (HttpAuthSchemeTarget) other;
            return Objects.equals(httpAuthScheme, o.httpAuthScheme)
                && Objects.equals(identityProvider, o.identityProvider)
                && Objects.equals(signer, o.signer);
        }

        @Override
        public int hashCode() {
            return super.hashCode();
        }
    }

    private List<HttpAuthSchemeTarget> getHttpAuthSchemeTargets(
        LanguageTarget target,
        Map<ShapeId, HttpAuthScheme> httpAuthSchemes
    ) {
        return getPartialHttpAuthSchemeTargets(target, httpAuthSchemes)
            .values()
            .stream()
            .filter(httpAuthSchemeTarget -> httpAuthSchemeTarget.signer != null)
            .toList();
    }

    private Map<ShapeId, HttpAuthSchemeTarget> getPartialHttpAuthSchemeTargets(
        LanguageTarget target,
        Map<ShapeId, HttpAuthScheme> httpAuthSchemes
    ) {
        LanguageTarget inherited;
        if (target.equals(LanguageTarget.SHARED)) {
            // SHARED doesn't inherit any target, so inherited is null
            inherited = null;
        } else if (target.equals(LanguageTarget.NODE) || target.equals(LanguageTarget.BROWSER)) {
            inherited = LanguageTarget.SHARED;
        } else if (target.equals(LanguageTarget.REACT_NATIVE)) {
            inherited = LanguageTarget.BROWSER;
        } else {
            throw new CodegenException("Unsupported Language Target: " + target);
        }

        Map<ShapeId, HttpAuthSchemeTarget> httpAuthSchemeTargets = inherited == null
            // SHARED inherits no HttpAuthSchemeTargets
            ? new TreeMap<>()
            // Otherwise, get inherited HttpAuthSchemeTargets
            : getPartialHttpAuthSchemeTargets(inherited, httpAuthSchemes);

        for (HttpAuthScheme httpAuthScheme : httpAuthSchemes.values()) {
            // If HttpAuthScheme is not registered, skip code generation
            if (httpAuthScheme == null) {
                continue;
            }

            // Get identity provider and signer for the current target
            Consumer<TypeScriptWriter> identityProvider =
                httpAuthScheme.getDefaultIdentityProviders().get(target);
            Consumer<TypeScriptWriter> signer =
                httpAuthScheme.getDefaultSigners().get(target);

            HttpAuthSchemeTarget existingEntry =
                httpAuthSchemeTargets.get(httpAuthScheme.getSchemeId());

            // If HttpAuthScheme is not added yet, add the entry
            if (existingEntry == null) {
                httpAuthSchemeTargets.put(httpAuthScheme.getSchemeId(),
                    new HttpAuthSchemeTarget(httpAuthScheme, identityProvider, signer));
                continue;
            }

            // Mutate existing entry for identity provider and signer if available
            if (identityProvider != null) {
                existingEntry.identityProvider = identityProvider;
            }
            if (signer != null) {
                existingEntry.signer = signer;
            }
        }
        return httpAuthSchemeTargets;
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
