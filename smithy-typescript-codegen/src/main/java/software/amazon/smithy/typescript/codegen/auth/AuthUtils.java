/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth;

import java.nio.file.Paths;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.knowledge.ServiceIndex.AuthSchemeMode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
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
}
