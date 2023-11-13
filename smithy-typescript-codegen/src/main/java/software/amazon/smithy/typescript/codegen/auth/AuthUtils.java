/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth;

import java.nio.file.Paths;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.knowledge.ServiceIndex.AuthSchemeMode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.ConfigField;
import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthSchemeParameter;
import software.amazon.smithy.typescript.codegen.auth.http.SupportedHttpAuthSchemesIndex;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Auth utility methods needed across Java packages.
 */
@SmithyInternalApi
public final class AuthUtils {
    public static final String HTTP_AUTH_FOLDER = "auth";

    public static final String HTTP_AUTH_SCHEME_PROVIDER_MODULE =
        Paths.get(".", CodegenUtils.SOURCE_FOLDER, HTTP_AUTH_FOLDER, "httpAuthSchemeProvider").toString();

    public static final String HTTP_AUTH_SCHEME_PROVIDER_PATH = HTTP_AUTH_SCHEME_PROVIDER_MODULE + ".ts";

    public static final Dependency AUTH_HTTP_PROVIDER_DEPENDENCY = new Dependency() {
        @Override
        public String getPackageName() {
            return HTTP_AUTH_SCHEME_PROVIDER_MODULE;
        }

        @Override
        public List<SymbolDependency> getDependencies() {
            return Collections.emptyList();
        }
    };

    public static final String HTTP_AUTH_SCHEME_EXTENSION_MODULE =
        Paths.get(".", CodegenUtils.SOURCE_FOLDER, HTTP_AUTH_FOLDER, "httpAuthExtensionConfiguration").toString();

    public static final String HTTP_AUTH_SCHEME_EXTENSION_PATH = HTTP_AUTH_SCHEME_EXTENSION_MODULE + ".ts";

    public static final Dependency AUTH_HTTP_EXTENSION_DEPENDENCY = new Dependency() {
        @Override
        public String getPackageName() {
            return HTTP_AUTH_SCHEME_EXTENSION_MODULE;
        }

        @Override
        public List<SymbolDependency> getDependencies() {
            return Collections.emptyList();
        }
    };

    private AuthUtils() {}

    public static Map<ShapeId, HttpAuthScheme> getAllEffectiveNoAuthAwareAuthSchemes(
        ServiceShape serviceShape,
        ServiceIndex serviceIndex,
        SupportedHttpAuthSchemesIndex authIndex
    ) {
        Map<ShapeId, HttpAuthScheme> effectiveAuthSchemes = new TreeMap<>();
        var serviceEffectiveAuthSchemes =
            serviceIndex.getEffectiveAuthSchemes(serviceShape, AuthSchemeMode.NO_AUTH_AWARE);
        for (ShapeId shapeId : serviceEffectiveAuthSchemes.keySet()) {
            effectiveAuthSchemes.put(shapeId, authIndex.getHttpAuthScheme(shapeId));
        }
        for (var operation : serviceShape.getAllOperations()) {
            var operationEffectiveAuthSchemes =
                serviceIndex.getEffectiveAuthSchemes(serviceShape, operation, AuthSchemeMode.NO_AUTH_AWARE);
            for (ShapeId shapeId : operationEffectiveAuthSchemes.keySet()) {
                effectiveAuthSchemes.put(shapeId, authIndex.getHttpAuthScheme(shapeId));
            }
        }
        // TODO(experimentalIdentityAndAuth): remove after @aws.auth#sigv4a is fully supported
        // BEGIN
        HttpAuthScheme effectiveSigv4Scheme = effectiveAuthSchemes.get(ShapeId.from("aws.auth#sigv4"));
        HttpAuthScheme effectiveSigv4aScheme = effectiveAuthSchemes.get(ShapeId.from("aws.auth#sigv4a"));
        HttpAuthScheme supportedSigv4aScheme = authIndex.getHttpAuthScheme(ShapeId.from("aws.auth#sigv4a"));
        if (effectiveSigv4Scheme != null && effectiveSigv4aScheme == null && supportedSigv4aScheme != null) {
            effectiveAuthSchemes.put(supportedSigv4aScheme.getSchemeId(), supportedSigv4aScheme);
        }
        // END
        return effectiveAuthSchemes;
    }

    public static Map<String, ConfigField> collectConfigFields(Collection<HttpAuthScheme> httpAuthSchemes) {
        Map<String, ConfigField> configFields = new HashMap<>();
        for (HttpAuthScheme authScheme : httpAuthSchemes) {
            if (authScheme == null) {
                continue;
            }
            for (ConfigField configField : authScheme.getConfigFields()) {
                if (configFields.containsKey(configField.name())) {
                    ConfigField existingConfigField = configFields.get(configField.name());
                    if (!configField.equals(existingConfigField)) {
                        throw new CodegenException("Contradicting `ConfigField` defintions for `"
                            + configField.name()
                            + "`; existing: "
                            + existingConfigField
                            + ", conflict: "
                            + configField);
                    }
                } else {
                    configFields.put(configField.name(), configField);
                }
            }
        }
        return configFields;
    }

    public static Map<String, HttpAuthSchemeParameter> collectHttpAuthSchemeParameters(
        Collection<HttpAuthScheme> httpAuthSchemes) {
        Map<String, HttpAuthSchemeParameter> httpAuthSchemeParameters = new HashMap<>();
        for (HttpAuthScheme authScheme : httpAuthSchemes) {
            if (authScheme == null) {
                continue;
            }
            for (HttpAuthSchemeParameter param : authScheme.getHttpAuthSchemeParameters()) {
                if (httpAuthSchemeParameters.containsKey(param.name())) {
                    HttpAuthSchemeParameter existingParam = httpAuthSchemeParameters.get(param.name());
                    if (!param.equals(existingParam)) {
                        throw new CodegenException("Contradicting `HttpAuthSchemeParameter` defintions for `"
                            + param.name()
                            + "`; existing: "
                            + existingParam
                            + ", conflict: "
                            + param);
                    }
                } else {
                    httpAuthSchemeParameters.put(param.name(), param);
                }
            }
        }
        return httpAuthSchemeParameters;
    }

    public static boolean areHttpAuthSchemesEqual(
        Map<ShapeId, Trait> httpAuthSchemes1,
        Map<ShapeId, Trait> httpAuthSchemes2
    ) {
        if (httpAuthSchemes1.size() != httpAuthSchemes2.size()) {
            return false;
        }
        var iter1 = httpAuthSchemes1.entrySet().iterator();
        var iter2 = httpAuthSchemes2.entrySet().iterator();
        while (iter1.hasNext() && iter2.hasNext()) {
            var entry1 = iter1.next();
            var entry2 = iter2.next();
            if (!entry1.equals(entry2)) {
                return false;
            }
        }
        return true;
    }
}
