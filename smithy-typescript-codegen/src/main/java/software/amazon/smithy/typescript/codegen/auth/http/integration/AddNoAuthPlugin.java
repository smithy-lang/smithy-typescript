/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.Optional;
import java.util.function.Consumer;
import software.amazon.smithy.model.traits.synthetic.NoAuthTrait;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Add config and middleware to support the synthetic @noAuth auth scheme.
 */
@SmithyInternalApi
public final class AddNoAuthPlugin implements HttpAuthTypeScriptIntegration {
    private static final Consumer<TypeScriptWriter> NO_AUTH_IDENTITY_PROVIDER_WRITER =
        w -> w.write("async () => ({})");
    private static final Consumer<TypeScriptWriter> NO_AUTH_SIGNER_WRITER = w -> {
        w.addDependency(TypeScriptDependency.SMITHY_CORE);
        w.addImport("NoAuthSigner", null, TypeScriptDependency.SMITHY_CORE);
        w.write("new NoAuthSigner()");
    };

    /**
     * Integration should only be used if `experimentalIdentityAndAuth` flag is true.
     */
    @Override
    public boolean matchesSettings(TypeScriptSettings settings) {
        return settings.getExperimentalIdentityAndAuth();
    }

    @Override
    public Optional<HttpAuthScheme> getHttpAuthScheme() {
        return Optional.of(HttpAuthScheme.builder()
            .schemeId(NoAuthTrait.ID)
            .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
            .putDefaultIdentityProvider(LanguageTarget.SHARED, NO_AUTH_IDENTITY_PROVIDER_WRITER)
            .putDefaultSigner(LanguageTarget.SHARED, NO_AUTH_SIGNER_WRITER)
            .build());
    }
}
