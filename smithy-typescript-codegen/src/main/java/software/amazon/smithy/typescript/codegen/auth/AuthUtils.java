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

    public static final String HTTP_AUTH_SCHEME_PROVIDER_MODULE = "httpAuthSchemeProvider";

    public static final String HTTP_AUTH_SCHEME_PROVIDER_FILE =
        HTTP_AUTH_SCHEME_PROVIDER_MODULE + ".ts";

    public static final String HTTP_AUTH_SCHEME_PROVIDER_PATH =
        Paths.get(".", CodegenUtils.SOURCE_FOLDER, HTTP_AUTH_FOLDER, HTTP_AUTH_SCHEME_PROVIDER_FILE).toString();

    public static final Dependency AUTH_HTTP_PROVIDER_DEPENDENCY = new Dependency() {
        @Override
        public String getPackageName() {
            return Paths.get(
                ".", CodegenUtils.SOURCE_FOLDER,
                HTTP_AUTH_FOLDER, HTTP_AUTH_SCHEME_PROVIDER_MODULE
            ).toString();
        }

        @Override
        public List<SymbolDependency> getDependencies() {
            return Collections.emptyList();
        }
    };

    public static final String HTTP_AUTH_SCHEME_EXTENSION_MODULE = "httpAuthExtensionConfiguration";

    public static final String HTTP_AUTH_SCHEME_EXTENSION_FILE =
        HTTP_AUTH_SCHEME_EXTENSION_MODULE + ".ts";

    public static final String HTTP_AUTH_SCHEME_EXTENSION_PATH =
        Paths.get(".", CodegenUtils.SOURCE_FOLDER, HTTP_AUTH_FOLDER, HTTP_AUTH_SCHEME_EXTENSION_FILE).toString();

    public static final Dependency AUTH_HTTP_EXTENSION_DEPENDENCY = new Dependency() {
        @Override
        public String getPackageName() {
            return Paths.get(
                ".", CodegenUtils.SOURCE_FOLDER,
                HTTP_AUTH_FOLDER, HTTP_AUTH_SCHEME_EXTENSION_MODULE
            ).toString();
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
        return effectiveAuthSchemes;
    }
}
