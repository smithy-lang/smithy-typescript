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
import java.util.Optional;
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
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.auth.AuthUtils;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthOptionProperty.Type;
import software.amazon.smithy.typescript.codegen.auth.http.sections.DefaultHttpAuthSchemeParametersProviderFunctionCodeSection;
import software.amazon.smithy.typescript.codegen.auth.http.sections.DefaultHttpAuthSchemeProviderFunctionCodeSection;
import software.amazon.smithy.typescript.codegen.auth.http.sections.HttpAuthOptionFunctionCodeSection;
import software.amazon.smithy.typescript.codegen.auth.http.sections.HttpAuthOptionFunctionsCodeSection;
import software.amazon.smithy.typescript.codegen.auth.http.sections.HttpAuthSchemeParametersProviderInterfaceCodeSection;
import software.amazon.smithy.typescript.codegen.auth.http.sections.HttpAuthSchemeProviderInterfaceCodeSection;
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
    private final TypeScriptSettings settings;
    private final Model model;
    private final SymbolProvider symbolProvider;
    private final List<TypeScriptIntegration> integrations;

    private final SupportedHttpAuthSchemesIndex authIndex;
    private final ServiceIndex serviceIndex;
    private final ServiceShape serviceShape;
    private final Symbol serviceSymbol;
    private final String serviceName;
    private final Map<ShapeId, HttpAuthScheme> effectiveHttpAuthSchemes;
    private final Map<String, HttpAuthSchemeParameter> httpAuthSchemeParameters;

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
        this.settings = settings;
        this.model = model;
        this.symbolProvider = symbolProvider;
        this.integrations = integrations;

        this.authIndex = new SupportedHttpAuthSchemesIndex(integrations, model, settings);
        this.serviceIndex = ServiceIndex.of(model);
        this.serviceShape = settings.getService(model);
        this.serviceSymbol = symbolProvider.toSymbol(serviceShape);
        this.serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
        this.effectiveHttpAuthSchemes =
            AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(serviceShape, serviceIndex, authIndex);
        this.httpAuthSchemeParameters =
            AuthUtils.collectHttpAuthSchemeParameters(effectiveHttpAuthSchemes.values());
    }

    @Override
    public void run() {
        generateHttpAuthSchemeParametersInterface();
        generateHttpAuthSchemeParametersProviderInterface();
        generateDefaultHttpAuthSchemeParametersProviderFunction();
        generateHttpAuthOptionFunctions();
        generateHttpAuthSchemeProviderInterface();
        generateDefaultHttpAuthSchemeProviderFunction();
    }

    /*
    import { HttpAuthSchemeParameters } from "@smithy/types";

    // ...

    export interface WeatherHttpAuthSchemeParameters extends HttpAuthSchemeParameters {
    }
    */
    private void generateHttpAuthSchemeParametersInterface() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.pushState(HttpAuthSchemeProviderInterfaceCodeSection.builder()
                .service(serviceShape)
                .settings(settings)
                .model(model)
                .symbolProvider(symbolProvider)
                .build());
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.addImport("HttpAuthSchemeParameters", null, TypeScriptDependency.SMITHY_TYPES);
            w.openBlock("""
                /**
                 * @internal
                 */
                export interface $LHttpAuthSchemeParameters extends HttpAuthSchemeParameters {""", "}",
                serviceName,
                () -> {
                for (HttpAuthSchemeParameter parameter : httpAuthSchemeParameters.values()) {
                    w.write("$L?: $C;", parameter.name(), parameter.type());
                }
            });
            w.popState();
        });
    }

    /*
    import { HttpAuthSchemeParametersProvider } from "@smithy/types";
    import { WeatherClientResolvedConfig } from "../WeatherClient";

    // ...

    export interface WeatherHttpAuthSchemeParametersProvider extends HttpAuthSchemeParametersProvider<
      WeatherClientResolvedConfig,
      HandlerExecutionContext,
      WeatherHttpAuthSchemeParameters,
      object
    > {}
    */
    private void generateHttpAuthSchemeParametersProviderInterface() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.pushState(HttpAuthSchemeParametersProviderInterfaceCodeSection.builder()
                .service(serviceShape)
                .settings(settings)
                .model(model)
                .symbolProvider(symbolProvider)
                .build());
            w.addRelativeImport(serviceSymbol.getName() + "ResolvedConfig", null,
                Paths.get(".", serviceSymbol.getNamespace()));
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.addImport("HttpAuthSchemeParametersProvider", null, TypeScriptDependency.SMITHY_TYPES);
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.addImport("HandlerExecutionContext", null, TypeScriptDependency.SMITHY_TYPES);
            w.write("""
                /**
                 * @internal
                 */
                export interface $LHttpAuthSchemeParametersProvider extends \
                HttpAuthSchemeParametersProvider<\
                $LResolvedConfig, \
                HandlerExecutionContext, \
                $LHttpAuthSchemeParameters, \
                object> {}""",
                serviceName, serviceSymbol.getName(), serviceName);
            w.popState();
        });
    }

    /*
    export const defaultWeatherHttpAuthSchemeParametersProvider =
    async (config: WeatherClientResolvedConfig, context: HandlerExecutionContext, input: object):
    Promise<WeatherHttpAuthSchemeParameters> => {
      return {
        operation: getSmithyContext(context).operation as string,
      };
    };
    */
    private void generateDefaultHttpAuthSchemeParametersProviderFunction() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.pushState(DefaultHttpAuthSchemeParametersProviderFunctionCodeSection.builder()
                .service(serviceShape)
                .settings(settings)
                .model(model)
                .symbolProvider(symbolProvider)
                .httpAuthSchemeParameters(httpAuthSchemeParameters)
                .build());
            w.addRelativeImport(serviceSymbol.getName() + "ResolvedConfig", null,
                Paths.get(".", serviceSymbol.getNamespace()));
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.addImport("HandlerExecutionContext", null, TypeScriptDependency.SMITHY_TYPES);
            w.addDependency(TypeScriptDependency.UTIL_MIDDLEWARE);
            w.addImport("getSmithyContext", null, TypeScriptDependency.UTIL_MIDDLEWARE);
            w.openBlock("""
                /**
                 * @internal
                 */
                export const default$LHttpAuthSchemeParametersProvider = async (\
                config: $LResolvedConfig, \
                context: HandlerExecutionContext, \
                input: object): Promise<$LHttpAuthSchemeParameters> => {""", "};",
                serviceName, serviceSymbol.getName(), serviceName,
                () -> {
                w.openBlock("return {", "};", () -> {
                    w.write("operation: getSmithyContext(context).operation as string,");
                    for (HttpAuthSchemeParameter parameter : httpAuthSchemeParameters.values()) {
                        w.write("$L: $C,", parameter.name(), parameter.source());
                    }
                });
            });
            w.popState();
        });
    }

    private void generateHttpAuthOptionFunctions() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.pushState(HttpAuthOptionFunctionsCodeSection.builder()
                .service(serviceShape)
                .settings(settings)
                .model(model)
                .symbolProvider(symbolProvider)
                .effectiveHttpAuthSchemes(effectiveHttpAuthSchemes)
                .build());
            for (Entry<ShapeId, HttpAuthScheme> entry : effectiveHttpAuthSchemes.entrySet()) {
                generateHttpAuthOptionFunction(w, HttpAuthOptionFunctionCodeSection.builder()
                    .service(serviceShape)
                    .settings(settings)
                    .model(model)
                    .symbolProvider(symbolProvider)
                    .effectiveHttpAuthSchemes(effectiveHttpAuthSchemes)
                    .schemeId(entry.getKey())
                    .httpAuthScheme(entry.getValue())
                    .build());
            }
            w.popState();
        });
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
    private void generateHttpAuthOptionFunction(
        TypeScriptWriter w,
        HttpAuthOptionFunctionCodeSection s
    ) {
        w.pushState(s);
        ShapeId schemeId = s.getSchemeId();
        String normalizedAuthSchemeName = normalizeAuthSchemeName(schemeId);
        Optional<HttpAuthScheme> authSchemeOptional = s.getHttpAuthScheme();
        w.addDependency(TypeScriptDependency.SMITHY_TYPES);
        w.addImport("HttpAuthOption", null, TypeScriptDependency.SMITHY_TYPES);
        w.openBlock("""
            function create$LHttpAuthOption(authParameters: $LHttpAuthSchemeParameters): \
            HttpAuthOption {""", "};\n",
            normalizedAuthSchemeName, serviceName,
            () -> {
            w.openBlock("return {", "};", () -> {
                w.write("schemeId: $S,", schemeId.toString());
                // If no HttpAuthScheme is registered, there are no HttpAuthOptionProperties available.
                if (authSchemeOptional.isEmpty()) {
                    return;
                }
                HttpAuthScheme authScheme = authSchemeOptional.get();
                Trait trait = serviceShape.findTrait(authScheme.getTraitId()).orElse(null);
                List<HttpAuthOptionProperty> identityProperties =
                    authScheme.getHttpAuthSchemeOptionParametersByType(Type.IDENTITY);
                if (!identityProperties.isEmpty()) {
                    w.openBlock("identityProperties: {", "},", () -> {
                        for (HttpAuthOptionProperty parameter : identityProperties) {
                            w.write("$L: $C,",
                                parameter.name(),
                                parameter.source().apply(HttpAuthOptionProperty.Source.builder()
                                    .httpAuthScheme(authScheme)
                                    .trait(trait)
                                    .build()));
                        }
                    });
                }
                List<HttpAuthOptionProperty> signingProperties =
                    authScheme.getHttpAuthSchemeOptionParametersByType(Type.SIGNING);
                if (!signingProperties.isEmpty()) {
                    w.openBlock("signingProperties: {", "},", () -> {
                        for (HttpAuthOptionProperty parameter : signingProperties) {
                            w.write("$L: $C,",
                                parameter.name(),
                                parameter.source().apply(HttpAuthOptionProperty.Source.builder()
                                    .httpAuthScheme(authScheme)
                                    .trait(trait)
                                    .build()));
                        }
                    });
                }
                authScheme.getPropertiesExtractor()
                    .ifPresent(extractor -> w.write("propertiesExtractor: $C",
                        extractor.apply(serviceSymbol.getName() + "ResolvedConfig")));
            });
        });
        w.popState();
    }

    private static String normalizeAuthSchemeName(ShapeId shapeId) {
        return String.join("", Arrays
            .asList(shapeId.toString().split("[.#]"))
            .stream().map(StringUtils::capitalize)
            .toList());
    }

    /*
    import { HttpAuthSchemeProvider } from "@smithy/types";

    // ...

    export interface WeatherHttpAuthSchemeProvider extends HttpAuthSchemeProvider<WeatherHttpAuthSchemeParameters> {}
    */
    private void generateHttpAuthSchemeProviderInterface() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.pushState(HttpAuthSchemeProviderInterfaceCodeSection.builder()
                .service(serviceShape)
                .settings(settings)
                .model(model)
                .symbolProvider(symbolProvider)
                .build());
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.addImport("HttpAuthSchemeProvider", null, TypeScriptDependency.SMITHY_TYPES);
            w.write("""
            /**
             * @internal
             */
            export interface $LHttpAuthSchemeProvider extends HttpAuthSchemeProvider<$LHttpAuthSchemeParameters> {}
            """, serviceName, serviceName);
            w.popState();
        });
    }

    /*
    export const defaultWeatherHttpAuthSchemeProvider: WeatherHttpAuthSchemeProvider =
    (authParameters) => {
        const options: HttpAuthOption[] = [];
        switch (authParameters.operation) {
            default: {
                options.push(createSmithyApiHttpApiKeyAuthHttpAuthOption(authParameters));
            };
        };
        return options;
    };
    */
    private void generateDefaultHttpAuthSchemeProviderFunction() {
        delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, w -> {
            w.pushState(DefaultHttpAuthSchemeProviderFunctionCodeSection.builder()
                .service(serviceShape)
                .settings(settings)
                .model(model)
                .symbolProvider(symbolProvider)
                .build());
            w.openBlock("""
            /**
             * @internal
             */
            export const default$LHttpAuthSchemeProvider: $LHttpAuthSchemeProvider = \
            (authParameters) => {""", "};",
            serviceName, serviceName, () -> {
                w.write("const options: HttpAuthOption[] = [];");
                w.openBlock("switch (authParameters.operation) {", "};", () -> {
                    var serviceAuthSchemes = serviceIndex.getEffectiveAuthSchemes(
                        serviceShape, AuthSchemeMode.NO_AUTH_AWARE);
                    for (ShapeId operationShapeId : serviceShape.getAllOperations()) {
                        var operationAuthSchemes = serviceIndex.getEffectiveAuthSchemes(
                            serviceShape, operationShapeId, AuthSchemeMode.NO_AUTH_AWARE);
                        // Skip operation generation if operation auth schemes are equivalent to the default service
                        // auth schemes.
                        if (AuthUtils.areHttpAuthSchemesEqual(serviceAuthSchemes, operationAuthSchemes)) {
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
            w.popState();
        });
    }
}
