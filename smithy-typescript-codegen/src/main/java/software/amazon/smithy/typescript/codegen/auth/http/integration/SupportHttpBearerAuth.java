/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.Optional;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.traits.HttpBearerAuthTrait;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.auth.http.ConfigField;
import software.amazon.smithy.typescript.codegen.auth.http.ConfigField.Type;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Support for @httpBearerAuth.
 *
 * This is the experimental behavior for `experimentalIdentityAndAuth`.
 */
@SmithyInternalApi
public final class SupportHttpBearerAuth implements HttpAuthTypeScriptIntegration {
    private static final Consumer<TypeScriptWriter> HTTP_BEARER_AUTH_SIGNER = w ->
        w.write("new $T()", Symbol.builder()
            .name("HttpBearerAuthSigner")
            .namespace(TypeScriptDependency.SMITHY_CORE.getPackageName(), "/")
            .addDependency(TypeScriptDependency.SMITHY_CORE)
            .build());
    private static final Symbol TOKEN_IDENTITY = Symbol.builder()
        .name("TokenIdentity")
        .namespace(TypeScriptDependency.SMITHY_TYPES.getPackageName(), "/")
        .addDependency(TypeScriptDependency.SMITHY_TYPES)
        .build();
    private static final Symbol TOKEN_IDENTITY_PROVIDER = Symbol.builder()
        .name("TokenIdentityProvider")
        .namespace(TypeScriptDependency.SMITHY_TYPES.getPackageName(), "/")
        .addDependency(TypeScriptDependency.SMITHY_TYPES)
        .build();

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
                .schemeId(HttpBearerAuthTrait.ID)
                .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
                .addConfigField(ConfigField.builder()
                    .name("token")
                    .type(Type.MAIN)
                    .docs(w -> w.write("The token used to authenticate requests."))
                    .inputType(Symbol.builder()
                        .name("TokenIdentity | TokenIdentityProvider")
                        .addReference(TOKEN_IDENTITY)
                        .addReference(TOKEN_IDENTITY_PROVIDER)
                        .build())
                    .resolvedType(Symbol.builder()
                        .name("TokenIdentityProvider")
                        .addReference(TOKEN_IDENTITY_PROVIDER)
                        .build())
                    .configFieldWriter(ConfigField::defaultMainConfigFieldWriter)
                    .build())
                .putDefaultSigner(LanguageTarget.SHARED, HTTP_BEARER_AUTH_SIGNER)
                .build());
    }
}
