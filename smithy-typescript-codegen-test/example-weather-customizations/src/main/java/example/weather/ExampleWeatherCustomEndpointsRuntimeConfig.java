/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

package example.weather;

import java.nio.file.Paths;
import java.util.List;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.ToShapeId;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenContext;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.endpointsV2.EndpointsV2Generator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public final class ExampleWeatherCustomEndpointsRuntimeConfig implements TypeScriptIntegration {
    public static final String GENERIC_TEST_DIR = Paths.get(".", CodegenUtils.SOURCE_FOLDER, "generic").toString();
    public static final String INDEX_MODULE = GENERIC_TEST_DIR + "/index";
    public static final String INDEX_FILE = INDEX_MODULE + ".ts";
    public static final String ADD_CUSTOM_ENDPOINTS_FILE = GENERIC_TEST_DIR + "/customEndpoints" + ".ts";
    public static final String getClientFile(ShapeId service) {
        return Paths.get(".", CodegenUtils.SOURCE_FOLDER, service.getName() + "Client.ts").toString();
    }
    public static final ShapeId EXAMPLE_WEATHER_SERVICE_ID = ShapeId.from("example.weather#Weather");
    
    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        return List.of(
            RuntimeClientPlugin.builder()
                .inputConfig(Symbol.builder()
                        .namespace(INDEX_MODULE, "/")
                        .name("GenericCustomEndpointsInputConfig")
                        .build())
                .resolvedConfig(Symbol.builder()
                        .namespace(INDEX_MODULE, "/")
                        .name("GenericCustomEndpointsResolvedConfig")
                        .build())
                .resolveFunction(Symbol.builder()
                        .namespace(INDEX_MODULE, "/")
                        .name("resolveGenericCustomEndpointsConfig")
                        .build())
                .servicePredicate((m, s) -> isExampleWeatherService(s))
                .build(),
            RuntimeClientPlugin.builder()
                .withConventions(
                    TypeScriptDependency.MIDDLEWARE_ENDPOINTS_V2.dependency, "Endpoint", Convention.HAS_CONFIG)
                .servicePredicate((m, s) -> isExampleWeatherService(s))
                .build());
    }

    @Override
    public void customize(TypeScriptCodegenContext codegenContext) {
        if (!codegenContext.settings().generateClient()) {
            return;
        }

        if (!isExampleWeatherService(codegenContext.settings().getService())) {
            return;
        }

        codegenContext.writerDelegator().useFileWriter(INDEX_FILE, w -> {
            w.write("export * from \"./customEndpoints\";");
        });

        codegenContext.writerDelegator().useFileWriter(ADD_CUSTOM_ENDPOINTS_FILE, w -> {
            w.addTypeImport("Provider", "__Provider", TypeScriptDependency.SMITHY_TYPES);
            w.addImport("normalizeProvider", null, TypeScriptDependency.UTIL_MIDDLEWARE);
            w.write("""
                export interface GenericCustomEndpointsInputConfig {
                  region?: string | __Provider<string>;
                  endpointProvider?: any;
                }

                export interface GenericCustomEndpointsResolvedConfig {
                  region: __Provider<string>;
                  endpointProvider: any;
                }

                export const resolveGenericCustomEndpointsConfig = <T>(config: T & GenericCustomEndpointsInputConfig): \
                T & GenericCustomEndpointsResolvedConfig => {
                  return {
                    ...config,
                    endpointProvider: normalizeProvider(config.endpointProvider || "www.amazon.com"),
                    region: normalizeProvider(config.region || "us-west-2"),
                  };
                }
                """);
        });
    }

    private static boolean isExampleWeatherService(ToShapeId toShapeId) {
        return toShapeId.toShapeId().equals(EXAMPLE_WEATHER_SERVICE_ID);
    }
}
