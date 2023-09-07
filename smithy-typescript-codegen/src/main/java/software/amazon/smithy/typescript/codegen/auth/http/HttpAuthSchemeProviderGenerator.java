/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.knowledge.ServiceIndex.AuthSchemeMode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptDelegator;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.auth.AuthUtils;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthOptionProperty.Type;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.StringUtils;

/**
 * feat(experimentalIdentityAndAuth): Generator for {@code HttpAuthSchemeProvider} and corresponding interfaces.
 *
 * Code generated includes:
 *
 * - {@code $ServiceHttpAuthSchemeParameters}
 * - {@code default$ServiceHttpAuthSchemeParametersProvider}
 * - {@code create$AuthSchemeIdHttpAuthOption}
 * - {@code $ServiceHttpAuthSchemeProvider}
 * - {@code default$ServiceHttpAuthSchemeProvider}
 */
@SmithyInternalApi
public class HttpAuthSchemeProviderGenerator implements Runnable {
    private final TypeScriptDelegator delegator;
    private final Model model;

    private final SupportedHttpAuthSchemesIndex authIndex;
    private final ServiceIndex serviceIndex;
    private final ServiceShape serviceShape;
    private final Symbol serviceSymbol;
    private final String serviceName;

    /**
     * Create an HttpAuthSchemeProviderGenerator.
     * @param delegator delegator
     * @param settings settings
     * @param model model
     * @param symbolProvider symbolProvider
     * @param integrations integrations
     */
    public HttpAuthSchemeProviderGenerator(
        TypeScriptDelegator delegator,
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        List<TypeScriptIntegration> integrations
    ) {
        this.delegator = delegator;
        this.model = model;

        this.authIndex = new SupportedHttpAuthSchemesIndex(integrations);
        this.serviceIndex = ServiceIndex.of(model);
        this.serviceShape = settings.getService(model);
        this.serviceSymbol = symbolProvider.toSymbol(serviceShape);
        this.serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
    }

    @Override
    public void run() {
        generateHttpAuthSchemeParametersInterface();
        generateDefaultHttpAuthSchemeParametersProviderFunction();
        generateHttpAuthOptionFunctions();
        generateHttpAuthSchemeProviderInterface();
        generateHttpAuthSchemeProviderDefaultFunction();
    }

    /*
    export interface WeatherHttpAuthSchemeParameters {
        operation?: string;
    }
    */
    private void generateHttpAuthSchemeParametersInterface() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.openBlock("""
                /**
                 * @internal
                 */
                export interface $LHttpAuthSchemeParameters {""", "}",
                serviceName,
                () -> {
                w.write("operation?: string;");
                for (HttpAuthScheme authScheme : authIndex.getSupportedHttpAuthSchemes().values()) {
                    for (HttpAuthSchemeParameter parameter : authScheme.getHttpAuthSchemeParameters()) {
                        w.write("$L?: $C;", parameter.name(), parameter.type());
                    }
                }
            });
        });
    }

    /*
    import { WeatherClientResolvedConfig } from "../WeatherClient";
    import { HandlerExecutionContext } from "@smithy/types";

    // ...

    export async function defaultWeatherHttpAuthSchemeParametersProvider(
        config: WeatherClientResolvedConfig,
        context: HandlerExecutionContext
    ): Promise<WeatherHttpAuthSchemeParameters> {
        return {
            operation: context.commandName,
        };
    };
    */
    private void generateDefaultHttpAuthSchemeParametersProviderFunction() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.addRelativeImport(serviceSymbol.getName() + "ResolvedConfig", null,
                Paths.get(".", serviceSymbol.getNamespace()));
            w.addImport("HandlerExecutionContext", null, TypeScriptDependency.SMITHY_TYPES);
            w.openBlock("""
                /**
                 * @internal
                 */
                export async function default$LHttpAuthSchemeParametersProvider(
                    config: $LResolvedConfig,
                    context: HandlerExecutionContext
                ): Promise<$LHttpAuthSchemeParameters> {""", "};",
                serviceName, serviceSymbol.getName(), serviceName,
                () -> {
                w.openBlock("return {", "};", () -> {
                    w.write("operation: context.commandName,");
                    for (HttpAuthScheme authScheme : authIndex.getSupportedHttpAuthSchemes().values()) {
                        for (HttpAuthSchemeParameter parameter : authScheme.getHttpAuthSchemeParameters()) {
                            w.write("$L: $C,", parameter.name(), parameter.source());
                        }
                    }
                });
            });
        });
    }

    private void generateHttpAuthOptionFunctions() {
        Map<ShapeId, HttpAuthScheme> effectiveAuthSchemes =
            AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(serviceShape, serviceIndex, authIndex);
        for (Entry<ShapeId, HttpAuthScheme> entry : effectiveAuthSchemes.entrySet()) {
            generateHttpAuthOptionFunction(entry.getKey(), entry.getValue());
        }
    }

    /*
    import { HttpAuthOption } from "@smithy/types";

    // ...

    function createSmithyApiHttpApiKeyAuthHttpAuthOption(authParameters: WeatherHttpAuthSchemeParameters):
    HttpAuthOption[] {
        return {
            schemeId: "smithy.api#httpApiKeyAuth",
            signingProperties: {
                name: "Authorization",
                in: HttpApiKeyAuthLocation.HEADER,
                scheme: "",
            },
        };
    };
    */
    private void generateHttpAuthOptionFunction(ShapeId shapeId, HttpAuthScheme authScheme) {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            String normalizedAuthSchemeName = normalizeAuthSchemeName(shapeId);
            w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
            w.addImport("HttpAuthOption", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
            w.openBlock("""
                function create$LHttpAuthOption(authParameters: $LHttpAuthSchemeParameters): \
                HttpAuthOption {""", "};",
                normalizedAuthSchemeName, serviceName,
                () -> {
                w.openBlock("return {", "};", () -> {
                    w.write("schemeId: $S,", shapeId.toString());
                    // If no HttpAuthScheme is registered, there are no HttpAuthOptionProperties available.
                    if (authScheme == null) {
                        return;
                    }
                    Trait trait = serviceShape.findTrait(shapeId).orElse(null);
                    List<HttpAuthOptionProperty> identityProperties =
                        authScheme.getAuthSchemeOptionParametersByType(Type.IDENTITY);
                    if (!identityProperties.isEmpty()) {
                        w.openBlock("identityProperties: {", "},", () -> {
                            for (HttpAuthOptionProperty parameter : identityProperties) {
                                w.write("$L: $C,", parameter.name(), parameter.source().apply(trait));
                            }
                        });
                    }
                    List<HttpAuthOptionProperty> signingProperties =
                        authScheme.getAuthSchemeOptionParametersByType(Type.SIGNING);
                    if (!signingProperties.isEmpty()) {
                        w.openBlock("signingProperties: {", "},", () -> {
                            for (HttpAuthOptionProperty parameter : signingProperties) {
                                w.write("$L: $C,", parameter.name(), parameter.source().apply(trait));
                            }
                        });
                    }
                });
            });
        });
    }

    private static String normalizeAuthSchemeName(ShapeId shapeId) {
        return String.join("", Arrays
            .asList(shapeId.toString().split("[.#]"))
            .stream().map(StringUtils::capitalize)
            .toList());
    }

    /*
    export interface WeatherHttpAuthSchemeProvider {
        (authParameters: WeatherHttpAuthSchemeParameters): HttpAuthOption[];
    }
    */
    private void generateHttpAuthSchemeProviderInterface() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.write("""
            /**
             * @internal
             */
            export interface $LHttpAuthSchemeProvider {
              (authParameters: $LHttpAuthSchemeParameters): HttpAuthOption[];
            }
            """, serviceName, serviceName);
        });
    }

    /*
    export function defaultWeatherHttpAuthSchemeProvider(authParameters: WeatherHttpAuthSchemeParameters):
    HttpAuthOption[] {
        const options: HttpAuthOption[] = [];
        switch (authParameters.operation) {
            default: {
                options.push(createSmithyApiHttpApiKeyAuthHttpAuthOption(authParameters));
            };
        };
        return options;
    };
    */
    private void generateHttpAuthSchemeProviderDefaultFunction() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.openBlock("""
            /**
             * @internal
             */
            export function default$LHttpAuthSchemeProvider(authParameters: $LHttpAuthSchemeParameters): \
            HttpAuthOption[] {""", "};", serviceName, serviceName, () -> {
                w.write("const options: HttpAuthOption[] = [];");
                w.openBlock("switch (authParameters.operation) {", "};", () -> {
                    var serviceAuthSchemes = serviceIndex.getEffectiveAuthSchemes(
                        serviceShape, AuthSchemeMode.NO_AUTH_AWARE);
                    for (ShapeId operationShapeId : serviceShape.getAllOperations()) {
                        var operationAuthSchemes = serviceIndex.getEffectiveAuthSchemes(
                            serviceShape, operationShapeId, AuthSchemeMode.NO_AUTH_AWARE);
                        // Skip operation generation if operation auth schemes are equivalent to the default service
                        // auth schemes.
                        if (serviceAuthSchemes.equals(operationAuthSchemes)) {
                            continue;
                        }
                        w.openBlock("case $S: {", "};", operationShapeId.getName(), () -> {
                            operationAuthSchemes.keySet().forEach(shapeId -> {
                                w.write("options.push(create$LHttpAuthOption(authParameters));",
                                    normalizeAuthSchemeName(shapeId));
                            });
                            w.write("break;");
                        });
                    }
                    w.openBlock("default: {", "};", () -> {
                        serviceAuthSchemes.keySet().forEach(shapeId -> {
                            w.write("options.push(create$LHttpAuthOption(authParameters));",
                                normalizeAuthSchemeName(shapeId));
                        });
                    });
                });
                w.write("return options;");
            });
        });
    }
}
