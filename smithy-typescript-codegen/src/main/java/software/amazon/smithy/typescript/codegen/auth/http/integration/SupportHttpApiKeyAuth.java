/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.integration;

import java.util.Optional;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.traits.HttpApiKeyAuthTrait;
import software.amazon.smithy.model.traits.HttpApiKeyAuthTrait.Location;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.auth.http.ConfigField;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthOptionProperty;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthScheme;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Support for @httpApiKeyAuth.
 */
@SmithyInternalApi
public class SupportHttpApiKeyAuth implements HttpAuthTypeScriptIntegration {

    private static final Consumer<TypeScriptWriter> HTTP_API_KEY_AUTH_SIGNER = w ->
        w.write(
            "new $T()",
            Symbol.builder()
                .name("HttpApiKeyAuthSigner")
                .namespace(TypeScriptDependency.SMITHY_CORE.getPackageName(), "/")
                .addDependency(TypeScriptDependency.SMITHY_CORE)
                .build()
        );
    private static final Symbol API_KEY_IDENTITY = Symbol.builder()
        .name("ApiKeyIdentity")
        .namespace(TypeScriptDependency.SMITHY_TYPES.getPackageName(), "/")
        .addDependency(TypeScriptDependency.SMITHY_TYPES)
        .build();
    private static final Symbol API_KEY_IDENTITY_PROVIDER = Symbol.builder()
        .name("ApiKeyIdentityProvider")
        .namespace(TypeScriptDependency.SMITHY_TYPES.getPackageName(), "/")
        .addDependency(TypeScriptDependency.SMITHY_TYPES)
        .build();
    private static final Symbol HTTP_API_KEY_LOCATION = Symbol.builder()
        .name("HttpApiKeyAuthLocation")
        .namespace(TypeScriptDependency.SMITHY_TYPES.getPackageName(), "/")
        .addDependency(TypeScriptDependency.SMITHY_TYPES)
        .build();

    /**
     * Integration should be skipped if the `useLegacyAuth` flag is true.
     */
    @Override
    public boolean matchesSettings(TypeScriptSettings settings) {
        return !settings.useLegacyAuth();
    }

    @Override
    public Optional<HttpAuthScheme> getHttpAuthScheme() {
        return Optional.of(
            HttpAuthScheme.builder()
                .schemeId(HttpApiKeyAuthTrait.ID)
                .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
                .addConfigField(
                    ConfigField.builder()
                        .name("apiKey")
                        .type(ConfigField.Type.MAIN)
                        .docs(w -> w.write("The API key to use when making requests."))
                        .inputType(
                            Symbol.builder()
                                .name("ApiKeyIdentity | ApiKeyIdentityProvider")
                                .addReference(API_KEY_IDENTITY)
                                .addReference(API_KEY_IDENTITY_PROVIDER)
                                .build()
                        )
                        .resolvedType(
                            Symbol.builder()
                                .name("ApiKeyIdentityProvider")
                                .addReference(API_KEY_IDENTITY_PROVIDER)
                                .build()
                        )
                        .configFieldWriter(ConfigField::defaultMainConfigFieldWriter)
                        .build()
                )
                .addHttpAuthOptionProperty(
                    HttpAuthOptionProperty.builder()
                        .name("name")
                        .type(HttpAuthOptionProperty.Type.SIGNING)
                        .source(s -> w -> w.write("$S", ((HttpApiKeyAuthTrait) s.trait()).getName()))
                        .build()
                )
                .addHttpAuthOptionProperty(
                    HttpAuthOptionProperty.builder()
                        .name("in")
                        .type(HttpAuthOptionProperty.Type.SIGNING)
                        .source(
                            s ->
                                w -> {
                                    Location in = ((HttpApiKeyAuthTrait) s.trait()).getIn();
                                    switch (in) {
                                        case HEADER: {
                                            w.write("$T.HEADER", HTTP_API_KEY_LOCATION);
                                            break;
                                        }
                                        case QUERY: {
                                            w.write("$T.QUERY", HTTP_API_KEY_LOCATION);
                                            break;
                                        }
                                        default: {
                                            throw new CodegenException(
                                                "Encountered unsupported `in` property on " + "`@httpApiKeyAuth`: " + in
                                            );
                                        }
                                    }
                                }
                        )
                        .build()
                )
                .addHttpAuthOptionProperty(
                    HttpAuthOptionProperty.builder()
                        .name("scheme")
                        .type(HttpAuthOptionProperty.Type.SIGNING)
                        .source(
                            s ->
                                w ->
                                    ((HttpApiKeyAuthTrait) s.trait()).getScheme().ifPresentOrElse(
                                        scheme -> w.write("$S", scheme),
                                        () -> w.write("undefined")
                                    )
                        )
                        .build()
                )
                .putDefaultSigner(LanguageTarget.SHARED, HTTP_API_KEY_AUTH_SIGNER)
                .build()
        );
    }
}
