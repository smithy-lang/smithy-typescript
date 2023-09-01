/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.Optional;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.model.traits.HttpApiKeyAuthTrait;
import software.amazon.smithy.model.traits.HttpApiKeyAuthTrait.Location;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.ConfigField;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthOptionProperty;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthOptionProperty.Type;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Support for @httpApiKeyAuth.
 *
 * This is the experimental behavior for `experimentalIdentityAndAuth`.
 */
@SmithyInternalApi
public class AddHttpApiKeyAuthPlugin implements HttpAuthTypeScriptIntegration {
    private static final Consumer<TypeScriptWriter> HTTP_API_KEY_AUTH_SIGNER = w -> {
        w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
        w.addImport("HttpApiKeyAuthSigner", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
        w.write("new HttpApiKeyAuthSigner()");
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
                .schemeId(HttpApiKeyAuthTrait.ID)
                .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
                .addConfigField(new ConfigField("apiKey", w -> {
                    w.addImport("ApiKeyIdentity", null,
                        TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                    w.addImport("ApiKeyIdentityProvider", null,
                        TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                    w.write("ApiKeyIdentity | ApiKeyIdentityProvider");
                }, w -> w.write("The API key to use when making requests.")))
                .addHttpAuthOptionProperty(new HttpAuthOptionProperty(
                    "name", Type.SIGNING, t -> w -> {
                    HttpApiKeyAuthTrait httpApiKeyAuthTrait = (HttpApiKeyAuthTrait) t;
                    w.write("$S", httpApiKeyAuthTrait.getName());
                }))
                .addHttpAuthOptionProperty(new HttpAuthOptionProperty(
                    "in", Type.SIGNING, t -> w -> {
                    w.addImport("HttpApiKeyAuthLocation", null,
                        TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                    HttpApiKeyAuthTrait httpApiKeyAuthTrait = (HttpApiKeyAuthTrait) t;
                    if (httpApiKeyAuthTrait.getIn().equals(Location.HEADER)) {
                        w.write("HttpApiKeyAuthLocation.HEADER");
                    } else if (httpApiKeyAuthTrait.getIn().equals(Location.QUERY)) {
                        w.write("HttpApiKeyAuthLocation.QUERY");
                    } else {
                        throw new CodegenException("Encountered invalid `in` property on `@httpApiKeyAuth`: "
                        + httpApiKeyAuthTrait.getIn());
                    }
                }))
                .addHttpAuthOptionProperty(new HttpAuthOptionProperty(
                    "scheme", Type.SIGNING, t -> w -> {
                    HttpApiKeyAuthTrait httpApiKeyAuthTrait = (HttpApiKeyAuthTrait) t;
                    httpApiKeyAuthTrait.getScheme().ifPresentOrElse(
                        s -> w.write(s),
                        () -> w.write("undefined"));
                }))
                .putDefaultSigner(LanguageTarget.SHARED, HTTP_API_KEY_AUTH_SIGNER)
                .build());
    }
}
