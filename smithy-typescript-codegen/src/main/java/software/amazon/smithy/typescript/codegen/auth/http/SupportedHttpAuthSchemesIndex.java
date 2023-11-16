/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.auth.http.integration.HttpAuthTypeScriptIntegration;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Index of AuthSchemes supported in code generation through integrations.
 *
 * Integrations may mutate this index to customize {@link HttpAuthScheme}
 * implementations.
 *
 * This class is currently under the `experimentalIdentityAgitndAuth` experimental
 * flag, and is subject to breaking changes.
 */
@SmithyInternalApi
public final class SupportedHttpAuthSchemesIndex {
    private final Map<ShapeId, HttpAuthScheme> supportedHttpAuthSchemes = new HashMap<>();

    /**
     * Creates an index from registered {@link HttpAuthScheme}s in {@link TypeScriptIntegration}s.
     * @param integrations list of integrations to register HttpAuthSchemes
     */
    public SupportedHttpAuthSchemesIndex(
        List<TypeScriptIntegration> integrations,
        Model model,
        TypeScriptSettings settings
    ) {
        for (TypeScriptIntegration integration : integrations) {
            if (!(integration instanceof HttpAuthTypeScriptIntegration)) {
                continue;
            }
            HttpAuthTypeScriptIntegration httpAuthIntegration = (HttpAuthTypeScriptIntegration) integration;
            if (httpAuthIntegration.getHttpAuthScheme().isPresent()) {
                HttpAuthScheme authScheme = httpAuthIntegration.getHttpAuthScheme().get();
                this.putHttpAuthScheme(authScheme.getSchemeId(), authScheme);
            }
            httpAuthIntegration.customizeSupportedHttpAuthSchemes(this, model, settings);
        }
    }

    /**
     * Registers an {@link HttpAuthScheme}.
     * @param schemeId schemeId of authScheme
     * @param authScheme auth scheme to put
     * @return the auth scheme that was there previously or null
     */
    public HttpAuthScheme putHttpAuthScheme(ShapeId schemeId, HttpAuthScheme authScheme) {
        return supportedHttpAuthSchemes.put(schemeId, authScheme);
    }

    /**
     * Gets an {@link HttpAuthScheme}.
     * @param schemeId schemeId of auth scheme to get
     * @return the auth scheme or null if not found
     */
    public HttpAuthScheme getHttpAuthScheme(ShapeId schemeId) {
        return supportedHttpAuthSchemes.get(schemeId);
    }

    /**
     * Removes an {@link HttpAuthScheme}.
     * @param schemeId schemeId of auth scheme to remove
     * @return the removed auth scheme or null if nothing was previously put
     */
    public HttpAuthScheme removeHttpAuthScheme(ShapeId schemeId) {
        return supportedHttpAuthSchemes.remove(schemeId);
    }

    /**
     * Gets the map of supported {@link HttpAuthScheme}s.
     * @return supportedHttpAuthSchemes
     */
    public Map<ShapeId, HttpAuthScheme> getSupportedHttpAuthSchemes() {
        return supportedHttpAuthSchemes;
    }
}
