/*
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package software.amazon.smithy.typescript.codegen.integration;

import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.HttpApiKeyAuthTrait;
import software.amazon.smithy.model.traits.OptionalAuthTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.IoUtils;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Add config and middleware to support a service with the @httpApiKeyAuth trait.
 */
@SmithyInternalApi
public final class AddHttpApiKeyAuthPlugin implements TypeScriptIntegration {

    /**
     * Plug into code generation for the client.
     *
     * This adds the configuration items to the client config and plugs in the
     * middleware to operations that need it.
     *
     * The middleware will inject the client's configured API key into the
     * request as defined by the @httpApiKeyAuth trait. If the trait says to
     * put the API key into a named header, that header will be used, optionally
     * prefixed with a scheme. If the trait says to put the API key into a named
     * query parameter, that query parameter will be used.
     */
    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        String middlewarePath = getMiddlewarePath();
        return ListUtils.of(
            // Add the config if the service uses HTTP API key authorization.
            RuntimeClientPlugin.builder()
                    .inputConfig(Symbol.builder()
                            .namespace("./" + CodegenUtils.SOURCE_FOLDER + "/middleware/" + middlewarePath, "/")
                            .name("HttpApiKeyAuthInputConfig")
                            .build())
                    .resolvedConfig(Symbol.builder()
                            .namespace("./" + CodegenUtils.SOURCE_FOLDER + "/middleware/" + middlewarePath, "/")
                            .name("HttpApiKeyAuthResolvedConfig")
                            .build())
                    .resolveFunction(Symbol.builder()
                            .namespace("./" + CodegenUtils.SOURCE_FOLDER + "/middleware/" + middlewarePath, "/")
                            .name("resolveHttpApiKeyAuthConfig")
                            .build())
                    .servicePredicate((m, s) -> hasEffectiveHttpApiKeyAuthTrait(m, s))
                    .build(),

            // Add the middleware to operations that use HTTP API key authorization.
            RuntimeClientPlugin.builder()
                    .pluginFunction(Symbol.builder()
                            .namespace("./" + CodegenUtils.SOURCE_FOLDER + "/middleware/" + middlewarePath, "/")
                            .name("getHttpApiKeyAuthPlugin")
                            .build())
                    .additionalPluginFunctionParamsSupplier((m, s, o) -> new HashMap<String, Object>() {{
                            // It's safe to do expectTrait() because the operation predicate ensures that the trait
                            // exists `in` and `name` are required attributes of the trait, `scheme` is optional.
                            put("in", s.expectTrait(HttpApiKeyAuthTrait.class).getIn().toString());
                            put("name", s.expectTrait(HttpApiKeyAuthTrait.class).getName());
                            s.expectTrait(HttpApiKeyAuthTrait.class).getScheme().ifPresent(scheme ->
                                    put("scheme", scheme));
                    }})
                    .operationPredicate((m, s, o) -> ServiceIndex.of(m).getEffectiveAuthSchemes(s, o)
                            .keySet()
                            .contains(HttpApiKeyAuthTrait.ID)
                            && !o.hasTrait(OptionalAuthTrait.class))
                    .build()
        );
    }

    @Override
    public void writeAdditionalFiles(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        BiConsumer<String, Consumer<TypeScriptWriter>> writerFactory
    ) {
        ServiceShape service = settings.getService(model);

        // If the service doesn't use HTTP API keys, we don't need to do anything and the generated
        // code doesn't need any additional files.
        if (!hasEffectiveHttpApiKeyAuthTrait(model, service)) {
            return;
        }

        String noTouchNoticePrefix = "// Please do not touch this file. It's generated from a template in:\n"
                + "// https://github.com/awslabs/smithy-typescript/blob/main/smithy-typescript-codegen/"
                + "src/main/resources/software/amazon/smithy/aws/typescript/codegen/integration/";

        // Write the middleware source.
        writerFactory.accept(
                Paths.get(CodegenUtils.SOURCE_FOLDER, "middleware", getMiddlewarePath(), "index.ts").toString(),
                writer -> {
                        String source = IoUtils.readUtf8Resource(getClass(), "http-api-key-auth.ts");
                        writer.write("$L$L", noTouchNoticePrefix, "http-api-key-auth.ts");
                        writer.write("$L", source);
                });

        // Write the middleware tests.
        writerFactory.accept(
                Paths.get(CodegenUtils.SOURCE_FOLDER, "middleware", getMiddlewarePath(), "index.spec.ts").toString(),
                writer -> {
                        writer.addDependency(SymbolDependency.builder()
                                .dependencyType("devDependencies")
                                .packageName("@types/jest")
                                .version("latest")
                                .build());

                        String source = IoUtils.readUtf8Resource(getClass(), "http-api-key-auth.spec.ts");
                        writer.write("$L$L", noTouchNoticePrefix, "http-api-key-auth.spec.ts");
                        writer.write("$L", source);
                });
    }

    @Override
    public void writeAdditionalExports(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer
    ) {
        boolean isClientSdk = settings.generateClient();
        ServiceShape service = settings.getService(model);
        if (isClientSdk && hasEffectiveHttpApiKeyAuthTrait(model, service)) {
            writer.write("export * from \"./middleware/$1L\";", getMiddlewarePath());
        }
    }

    private String getMiddlewarePath() {
        return "HttpApiKeyAuth";
    }

    // The service has the effective trait if it's in the "effective auth schemes" response
    // AND if not all of the operations have the optional auth trait.
    private static boolean hasEffectiveHttpApiKeyAuthTrait(Model model, ServiceShape service) {
        return ServiceIndex.of(model).getEffectiveAuthSchemes(service)
                .keySet()
                .contains(HttpApiKeyAuthTrait.ID)
                && !areAllOptionalAuthOperations(model, service);
    }


    // This is derived from https://github.com/aws/aws-sdk-js-v3/blob/main/codegen/smithy-aws-typescript-codegen/src/main/java/software/amazon/smithy/aws/typescript/codegen/AddAwsAuthPlugin.java.
    private static boolean areAllOptionalAuthOperations(Model model, ServiceShape service) {
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        ServiceIndex index = ServiceIndex.of(model);

        for (OperationShape operation : operations) {
            if (index.getEffectiveAuthSchemes(service, operation).isEmpty()
                    || !operation.hasTrait(OptionalAuthTrait.class)) {
                return false;
            }
        }
        return true;
    }
}
