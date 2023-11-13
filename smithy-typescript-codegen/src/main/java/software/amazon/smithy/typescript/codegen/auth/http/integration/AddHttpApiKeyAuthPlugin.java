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
                .addConfigField(ConfigField.builder()
                    .name("apiKey")
                    .type(ConfigField.Type.MAIN)
                    .docs(w -> w.write("The API key to use when making requests."))
                    .inputType(w -> {
                        w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.addImport("ApiKeyIdentity", null,
                            TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.addImport("ApiKeyIdentityProvider", null,
                            TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.write("ApiKeyIdentity | ApiKeyIdentityProvider");
                    })
                    .resolvedType(w -> {
                        w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.addImport("ApiKeyIdentityProvider", null,
                            TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.write("ApiKeyIdentityProvider");
                    })
                    .build())
                .addHttpAuthOptionProperty(HttpAuthOptionProperty.builder()
                    .name("name")
                    .type(HttpAuthOptionProperty.Type.SIGNING)
                    .source(s -> w -> {
                        HttpApiKeyAuthTrait t = (HttpApiKeyAuthTrait) s.trait();
                        w.write("$S", t.getName());
                    })
                    .build())
                .addHttpAuthOptionProperty(HttpAuthOptionProperty.builder()
                    .name("in")
                    .type(HttpAuthOptionProperty.Type.SIGNING)
                    .source(s -> w -> {
                        w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        w.addImport("HttpApiKeyAuthLocation", null,
                            TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
                        HttpApiKeyAuthTrait t = (HttpApiKeyAuthTrait) s.trait();
                        if (t.getIn().equals(Location.HEADER)) {
                            w.write("HttpApiKeyAuthLocation.HEADER");
                        } else if (t.getIn().equals(Location.QUERY)) {
                            w.write("HttpApiKeyAuthLocation.QUERY");
                        } else {
                            throw new CodegenException("Encountered invalid `in` property on `@httpApiKeyAuth`: "
                            + t.getIn());
                        }
                    })
                    .build())
                .addHttpAuthOptionProperty(HttpAuthOptionProperty.builder()
                    .name("scheme")
                    .type(HttpAuthOptionProperty.Type.SIGNING)
                    .source(s -> w -> {
                        HttpApiKeyAuthTrait t = (HttpApiKeyAuthTrait) s.trait();
                        t.getScheme().ifPresentOrElse(
                            scheme -> w.write("$S", scheme),
                            () -> w.write("undefined"));
                    })
                    .build())
                .putDefaultSigner(LanguageTarget.SHARED, HTTP_API_KEY_AUTH_SIGNER)
                .build());
    }
}
