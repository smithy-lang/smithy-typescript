/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

package example.weather;

import java.nio.file.Paths;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenContext;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.endpointsV2.EndpointsV2Generator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public final class GenericTestAddCustomEndpointsRuntimeConfig implements TypeScriptIntegration {
    public static final String GENERIC_TEST_DIR = Paths.get(".", CodegenUtils.SOURCE_FOLDER, "generic").toString();
    public static final String INDEX_MODULE = GENERIC_TEST_DIR + "/index";
    public static final String INDEX_FILE = INDEX_MODULE + ".ts";
    public static final String ADD_CUSTOM_ENDPOINTS_FILE = GENERIC_TEST_DIR + "/customEndpoints" + ".ts";
    public static final String getClientFile(ShapeId service) {
        return Paths.get(".", CodegenUtils.SOURCE_FOLDER, service.getName() + "Client.ts").toString();
    }

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
                .build(),
            RuntimeClientPlugin.builder()
                .withConventions(
                    TypeScriptDependency.MIDDLEWARE_ENDPOINTS_V2.dependency, "Endpoint", Convention.HAS_CONFIG)
                .build());
    }

    @Override
    public void customize(TypeScriptCodegenContext codegenContext) {
        if (!codegenContext.settings().generateClient()) {
            return;
        }

        codegenContext.writerDelegator().useFileWriter(INDEX_FILE, w -> {
            w.write("export * from \"./customEndpoints\";");
        });

        codegenContext.writerDelegator().useFileWriter(getClientFile(codegenContext.settings().getService()), w -> {
            w.addImport("EndpointParameters", null, EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY);
        });

        codegenContext.writerDelegator().useFileWriter(ADD_CUSTOM_ENDPOINTS_FILE, w -> {
            w.addDependency(TypeScriptDependency.SMITHY_TYPES);
            w.addImport("Provider", "__Provider", TypeScriptDependency.SMITHY_TYPES);
            w.addDependency(TypeScriptDependency.UTIL_MIDDLEWARE);
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
}
