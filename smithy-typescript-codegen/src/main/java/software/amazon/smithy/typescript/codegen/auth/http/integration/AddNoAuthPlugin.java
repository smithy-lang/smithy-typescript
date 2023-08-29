/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.Optional;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.auth.AuthUtils;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Add config and middleware to support the synthetic @noAuth auth scheme.
 */
@SmithyInternalApi
public final class AddNoAuthPlugin implements HttpAuthTypeScriptIntegration {
    @Override
    public Optional<HttpAuthScheme> getHttpAuthScheme() {
        return Optional.of(HttpAuthScheme.builder()
            .schemeId(AuthUtils.NO_AUTH_ID)
            .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
            .putDefaultIdentityProvider(LanguageTarget.SHARED, w -> w.write("async () => ({})"))
            .putDefaultSigner(LanguageTarget.SHARED, w -> {
                w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.addImport("NoAuthSigner", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                w.write("new NoAuthSigner()");
            })
            .build());
    }
}
