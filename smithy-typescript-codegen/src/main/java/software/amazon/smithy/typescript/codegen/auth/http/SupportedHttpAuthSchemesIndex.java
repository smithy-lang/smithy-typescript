/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Logger;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.shapes.ShapeId;
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
    private static final Logger LOGGER = Logger.getLogger(SupportedHttpAuthSchemesIndex.class.getName());

    private final Map<ShapeId, HttpAuthScheme> supportedHttpAuthSchemes = new HashMap<>();
    private Optional<Symbol> defaultHttpAuthSchemeProvider = Optional.empty();

    /**
     * Creates an index from registered {@link HttpAuthScheme}s in {@link TypeScriptIntegration}s.
     * @param integrations list of integrations to register HttpAuthSchemes
     */
    public SupportedHttpAuthSchemesIndex(List<TypeScriptIntegration> integrations) {
        for (TypeScriptIntegration integration : integrations) {
            if (!(integration instanceof HttpAuthTypeScriptIntegration)) {
                continue;
            }
            HttpAuthTypeScriptIntegration httpAuthIntegration = (HttpAuthTypeScriptIntegration) integration;
            if (httpAuthIntegration.getHttpAuthScheme().isPresent()) {
                HttpAuthScheme authScheme = httpAuthIntegration.getHttpAuthScheme().get();
                this.putHttpAuthScheme(authScheme.getSchemeId(), authScheme);
            }
            httpAuthIntegration.customizeSupportedHttpAuthSchemes(this);
            if (httpAuthIntegration.getDefaultHttpAuthSchemeProvider().isPresent()) {
                Optional<Symbol> override =
                    httpAuthIntegration.getDefaultHttpAuthSchemeProvider();
                if (defaultHttpAuthSchemeProvider.isPresent()) {
                    LOGGER.warning("An existing `HttpAuthSchemeProvider` registration `"
                        + defaultHttpAuthSchemeProvider.get()
                        + "` is being overwritten by `"
                        + override.get()
                        + "`");
                }
                defaultHttpAuthSchemeProvider = override;
            }
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

    /**
     * Gets the default {@code HttpAuthSchemeProvider} symbol.
     * @return an optional with the symbol or empty.
     */
    public Optional<Symbol> getDefaultHttpAuthSchemeProvider() {
        return defaultHttpAuthSchemeProvider;
    }
}
