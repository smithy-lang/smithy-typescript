/*
 * Copyright 2023 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Consumer;
import java.util.logging.Logger;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.RequestCompressionTrait;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Adds compression dependencies if needed.
 */
@SmithyInternalApi
public final class AddCompressionDependency implements TypeScriptIntegration {

    private static final Logger LOGGER = Logger.getLogger(AddCompressionDependency.class.getName());

    @Override
    public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            LanguageTarget target
    ) {
        if (!hasRequestCompressionTrait(model, settings.getService(model))) {
            return Collections.emptyMap();
        }

        switch (target) {
            case NODE:
                return MapUtils.of(
                    "disableRequestCompression", writer -> {
                        writer.addDependency(TypeScriptDependency.NODE_CONFIG_PROVIDER);
                        writer.addDependency(TypeScriptDependency.MIDDLEWARE_COMPRESSION);
                        writer.addImport("loadConfig", "loadNodeConfig",
                                TypeScriptDependency.NODE_CONFIG_PROVIDER);
                        writer.addImport("NODE_DISABLE_REQUEST_COMPRESSION_CONFIG_OPTIONS", null,
                                TypeScriptDependency.MIDDLEWARE_COMPRESSION);
                        writer.write("loadNodeConfig(NODE_DISABLE_REQUEST_COMPRESSION_CONFIG_OPTIONS)");
                    },
                    "requestMinCompressionSizeBytes", writer -> {
                        writer.addDependency(TypeScriptDependency.NODE_CONFIG_PROVIDER);
                        writer.addDependency(TypeScriptDependency.MIDDLEWARE_COMPRESSION);
                        writer.addImport("loadConfig", "loadNodeConfig",
                                TypeScriptDependency.NODE_CONFIG_PROVIDER);
                        writer.addImport("NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_CONFIG_OPTIONS", null,
                                TypeScriptDependency.MIDDLEWARE_COMPRESSION);
                        writer.write("loadNodeConfig(NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_CONFIG_OPTIONS)");
                    }
                );
            case BROWSER:
                return MapUtils.of(
                    "disableRequestCompression", writer -> {
                        writer.addDependency(TypeScriptDependency.MIDDLEWARE_COMPRESSION);
                        writer.addImport("DEFAULT_DISABLE_REQUEST_COMPRESSION", null,
                            TypeScriptDependency.MIDDLEWARE_COMPRESSION);
                        writer.write("DEFAULT_DISABLE_REQUEST_COMPRESSION");
                    },
                    "requestMinCompressionSizeBytes", writer -> {
                        writer.addDependency(TypeScriptDependency.MIDDLEWARE_COMPRESSION);
                        writer.addImport("DEFAULT_NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES", null,
                            TypeScriptDependency.MIDDLEWARE_COMPRESSION);
                        writer.write("DEFAULT_NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES");
                    }
                );
            default:
                return Collections.emptyMap();
        }
    }

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        return ListUtils.of(
            RuntimeClientPlugin.builder()
                .withConventions(TypeScriptDependency.MIDDLEWARE_COMPRESSION.dependency,
                    "Compression", RuntimeClientPlugin.Convention.HAS_CONFIG)
                .servicePredicate((m, s) -> hasRequestCompressionTrait(m, s))
                .build(),
            RuntimeClientPlugin.builder()
                .withConventions(TypeScriptDependency.MIDDLEWARE_COMPRESSION.dependency,
                    "Compression", RuntimeClientPlugin.Convention.HAS_MIDDLEWARE)
                .additionalPluginFunctionParamsSupplier((m, s, o) -> getPluginFunctionParams(m, s, o))
                .operationPredicate((m, s, o) -> hasRequestCompressionTrait(o))
                .build()
        );
    }

    private static Map<String, Object> getPluginFunctionParams(
        Model model,
        ServiceShape service,
        OperationShape operation
    ) {
        Map<String, Object> params = new TreeMap<String, Object>();

        // Populate encodings from requestCompression trait
        RequestCompressionTrait requestCompressionTrait = operation.expectTrait(RequestCompressionTrait.class);
        params.put("encodings", requestCompressionTrait.getEncodings());

        return params;
    }

    // return true if operation shape is decorated with `httpChecksum` trait.
    private static boolean hasRequestCompressionTrait(OperationShape operation) {
        return operation.hasTrait(RequestCompressionTrait.class);
    }

    private static boolean hasRequestCompressionTrait(
            Model model,
            ServiceShape service
    ) {
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        for (OperationShape operation : operations) {
            if (hasRequestCompressionTrait(operation)) {
                return true;
            }
        }
        return false;
    }
}
