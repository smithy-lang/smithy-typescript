/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.OptionalAuthTrait;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.model.validation.ValidationUtils;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
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
    /**
     * Directory segment for {@code auth/}.
     */
    public static final String HTTP_AUTH_FOLDER = "auth";
    /**
     * File name segment for {@code httpAuthSchemeProvder}.
     */
    public static final String HTTP_AUTH_SCHEME_RESOLVER_MODULE = "httpAuthSchemeProvider";

    private static final String HTTP_AUTH_SCHEME_RESOLVER_FILE =
        HTTP_AUTH_SCHEME_RESOLVER_MODULE + ".ts";
    private static final String HTTP_AUTH_SCHEME_RESOLVER_PATH =
        Paths.get(CodegenUtils.SOURCE_FOLDER, HTTP_AUTH_FOLDER, HTTP_AUTH_SCHEME_RESOLVER_FILE).toString();

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
        validateAuthSchemesAreSupported();
        generateHttpAuthSchemeParametersInterface();
        generateDefaultHttpAuthSchemeParametersProviderFunction();
        generateHttpAuthOptionFunctions();
        generateHttpAuthSchemeProviderInterface();
        generateHttpAuthSchemeProviderDefaultFunction();
    }

    private void validateAuthSchemesAreSupported() {
        List<ShapeId> unsupportedAuthSchemes = new ArrayList<>();
        Map<ShapeId, Trait> serviceAuthSchemes = this.serviceIndex.getAuthSchemes(serviceShape);
        for (ShapeId authScheme : serviceAuthSchemes.keySet()) {
            if (this.authIndex.getHttpAuthScheme(authScheme) == null) {
                unsupportedAuthSchemes.add(authScheme);
            }
        }
        if (!unsupportedAuthSchemes.isEmpty()) {
            throw new CodegenException("Code generation is not supported for the following auth schemes: "
                + ValidationUtils.tickedList(unsupportedAuthSchemes));
        }
    }

    /*
    export interface WeatherHttpAuthSchemeParameters {
        operation?: string;
    }
    */
    private void generateHttpAuthSchemeParametersInterface() {
        delegator.useFileWriter(HTTP_AUTH_SCHEME_RESOLVER_PATH.toString(), w -> {
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
        delegator.useFileWriter(HTTP_AUTH_SCHEME_RESOLVER_PATH.toString(), w -> {
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
        for (Map.Entry<ShapeId, HttpAuthScheme> entry : this.authIndex.getSupportedHttpAuthSchemes().entrySet()) {
            if (this.serviceIndex.getAuthSchemes(serviceShape).containsKey(entry.getKey())) {
                generateHttpAuthOptionFunction(entry.getKey(), entry.getValue());
            }
        }

        // Check whether to generate @smithy.api#noAuth auth option function
        boolean shouldGenerateNoAuthOptionFunction = serviceIndex.getEffectiveAuthSchemes(serviceShape).isEmpty();
        shouldGenerateNoAuthOptionFunction |= serviceShape.getAllOperations().stream()
            .map(id -> model.expectShape(id, OperationShape.class))
            .anyMatch(o -> o.hasTrait(OptionalAuthTrait.ID)
                || serviceIndex.getEffectiveAuthSchemes(serviceShape, o).isEmpty());
        if (shouldGenerateNoAuthOptionFunction) {
            generateHttpAuthOptionFunction(AuthUtils.NO_AUTH_ID, HttpAuthScheme.builder()
                .schemeId(AuthUtils.NO_AUTH_ID)
                .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
                .build());
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
        delegator.useFileWriter(HTTP_AUTH_SCHEME_RESOLVER_PATH.toString(), w -> {
            String normalizedAuthScheme = normalizeAuthScheme(shapeId);
            w.addDependency(TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
            w.addImport("HttpAuthOption", null, TypeScriptDependency.EXPERIMENTAL_IDENTITY_AND_AUTH);
            w.openBlock("""
                function create$LHttpAuthOption(authParameters: $LHttpAuthSchemeParameters): \
                HttpAuthOption {""", "};",
                normalizedAuthScheme, serviceName,
                () -> {
                w.openBlock("return {", "};", () -> {
                    w.write("schemeId: $S,", shapeId.toString());
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

    private static String normalizeAuthScheme(ShapeId shapeId) {
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
        delegator.useFileWriter(HTTP_AUTH_SCHEME_RESOLVER_PATH.toString(), w -> {
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
        delegator.useFileWriter(HTTP_AUTH_SCHEME_RESOLVER_PATH.toString(), w -> {
            w.openBlock("""
            /**
             * @internal
             */
            export function default$LHttpAuthSchemeProvider(authParameters: $LHttpAuthSchemeParameters): \
            HttpAuthOption[] {""", "};", serviceName, serviceName, () -> {
                w.write("const options: HttpAuthOption[] = [];");
                w.openBlock("switch (authParameters.operation) {", "};", () -> {
                    var serviceAuthSchemes = serviceIndex.getEffectiveAuthSchemes(serviceShape);
                    for (ShapeId operationShapeId : serviceShape.getAllOperations()) {
                        var operationAuthSchemes = serviceIndex.getEffectiveAuthSchemes(serviceShape, operationShapeId);
                        Shape operationShape = this.model.expectShape(operationShapeId);
                        if (serviceAuthSchemes.equals(operationAuthSchemes)
                            && !operationShape.hasTrait(OptionalAuthTrait.ID)) {
                            continue;
                        }
                        w.openBlock("case $S: {", "};", operationShapeId.getName(), () -> {
                            operationAuthSchemes.keySet().forEach(shapeId -> {
                                w.write("options.push(create$LHttpAuthOption(authParameters));",
                                    normalizeAuthScheme(shapeId));
                            });
                            if (operationAuthSchemes.get(AuthUtils.NO_AUTH_ID) != null || operationAuthSchemes.isEmpty()
                                || operationShape.hasTrait(OptionalAuthTrait.ID)) {
                                w.write("options.push(create$LHttpAuthOption(authParameters));",
                                    normalizeAuthScheme(AuthUtils.NO_AUTH_ID));
                            }
                            w.write("break;");
                        });
                    }
                    w.openBlock("default: {", "};", () -> {
                        serviceAuthSchemes.keySet().forEach(shapeId -> {
                            w.write("options.push(create$LHttpAuthOption(authParameters));",
                                normalizeAuthScheme(shapeId));
                        });
                        if (serviceAuthSchemes.get(AuthUtils.NO_AUTH_ID) != null || serviceAuthSchemes.isEmpty()) {
                            w.write("options.push(create$LHttpAuthOption(authParameters));",
                                normalizeAuthScheme(AuthUtils.NO_AUTH_ID));
                        }
                    });
                });
                w.write("return options;");
            });
        });
    }
}
