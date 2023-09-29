/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.Optional;
import java.util.function.Consumer;
import software.amazon.smithy.model.traits.HttpBearerAuthTrait;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.ConfigField;
import software.amazon.smithy.typescript.codegen.ConfigField.Type;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Support for @httpBearerAuth.
 */
@SmithyInternalApi
public final class AddHttpBearerAuthPlugin implements HttpAuthTypeScriptIntegration {
    private static final Consumer<TypeScriptWriter> HTTP_BEARER_AUTH_SIGNER = w -> {
        w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
        w.addImport("HttpBearerAuthSigner", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
        w.write("new HttpBearerAuthSigner()");
    };

    @Override
    public Optional<HttpAuthScheme> getHttpAuthScheme() {
        return Optional.of(HttpAuthScheme.builder()
                .schemeId(HttpBearerAuthTrait.ID)
                .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
                .addConfigField(ConfigField.builder()
                    .name("token")
                    .type(Type.MAIN)
                    .docs(w -> w.write("The token used to authenticate requests."))
                    .inputType(w -> {
                        w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.addImport("TokenIdentity", null,
                            TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.addImport("TokenIdentityProvider", null,
                            TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.write("TokenIdentity | TokenIdentityProvider");
                    })
                    .resolvedType(w -> {
                        w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.addImport("TokenIdentityProvider", null,
                            TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.write("TokenIdentityProvider");
                    })
                    .build())
                .putDefaultSigner(LanguageTarget.SHARED, HTTP_BEARER_AUTH_SIGNER)
                .build());
    }
}
