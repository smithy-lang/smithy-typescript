/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.Optional;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.typescript.codegen.auth.http.SupportedHttpAuthSchemesIndex;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Java SPI for customizing TypeScript code generation for `experimentalIdentityAndAuth`.
 *
 * This should NOT be used as it is highly susceptible to breaking changes.
 */
@SmithyInternalApi
public interface HttpAuthTypeScriptIntegration extends TypeScriptIntegration {
    /**
     * feat(experimentalIdentityAndAuth): Register an {@link HttpAuthScheme} that is used to generate the
     * {@code HttpAuthSchemeProvider} and corresponding config field and runtime config values.
     * @return an empty optional.
     */
    default Optional<HttpAuthScheme> getHttpAuthScheme() {
        return Optional.empty();
    }

    /**
     * feat(experimentalIdentityAndAuth): Mutate an {@link SupportedHttpAuthSchemesIndex} to mutate registered
     * {@link HttpAuthScheme}s, e.g. default {@code IdentityProvider}s and {@code HttpSigner}s.
     * @param supportedHttpAuthSchemesIndex index to mutate.
     */
    default void customizeSupportedHttpAuthSchemes(SupportedHttpAuthSchemesIndex supportedHttpAuthSchemesIndex) {
    }

    /**
     * feat(experimentalIdentityAndAuth): Register an {@link Symbol} that points to an {@code HttpAuthSchemeProvider}
     * implementation.
     * @return an empty optional.
     */
    default Optional<Symbol> getDefaultHttpAuthSchemeProvider() {
        return Optional.empty();
    }
}
