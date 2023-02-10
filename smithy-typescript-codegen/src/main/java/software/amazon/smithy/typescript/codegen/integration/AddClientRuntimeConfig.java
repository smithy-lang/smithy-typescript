/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.integration;

import java.util.Collections;
import java.util.Map;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * All clients need to know the max attempt to retry a request and logger
 * instance to print the log.
 *
 * <p>This plugin adds the following config interface fields:
 *
 * <ul>
 *     <li>maxAttempts: Provides value for how many times a request will be
 *     made at most in case of retry.</li>
 *     <li>retryMode: Specifies which retry algorithm to use.</li>
 *     <li>logger: Optional logger for logging debug/info/warn/error.</li>
 * </ul>
 *
 * <p>This plugin adds the following Node runtime specific values:
 *
 * <ul>
 *     <li>maxAttempts: Uses the default maxAttempts provider that checks things
 *     like environment variables and the AWS config file.</li>
 *     <li>retryMode: Specifies which retry algorithm to use.</li>
 *     <li>logger: Sets to empty as logger is passed in client configuration.</li>
 * </ul>
 *
 * <p>This plugin adds the following Browser runtime specific values:
 *
 * <ul>
 *     <li>maxAttempts: Returns default value of 3.</li>
 *     <li>retryMode: Provider which returns DEFAULT_RETRY_MODE.</li>
 *     <li>logger: Sets to empty as logger is passed in client configuration.</li>
 * </ul>
 */
@SmithyInternalApi
public final class AddClientRuntimeConfig implements TypeScriptIntegration {

    @Override
    public void addConfigInterfaceFields(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer
    ) {
        writer.addImport("Provider", "__Provider", TypeScriptDependency.AWS_SDK_TYPES.packageName);
        writer.addImport("Logger", "__Logger", TypeScriptDependency.AWS_SDK_TYPES.packageName);

        writer.writeDocs("Value for how many times a request will be made at most in case of retry.")
                .write("maxAttempts?: number | __Provider<number>;\n");
        writer.writeDocs("Specifies which retry algorithm to use.")
                .write("retryMode?: string | __Provider<string>;\n");
        writer.writeDocs("Optional logger for logging debug/info/warn/error.")
                .write("logger?: __Logger;\n");
    }

    @Override
    public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            LanguageTarget target
    ) {
        switch (target) {
            case SHARED:
                return MapUtils.of(
                        "logger", writer -> {
                            writer.addImport("NoOpLogger", null, "@aws-sdk/smithy-client");
                            writer.write("new NoOpLogger()");
                        }
                );
            case BROWSER:
                return MapUtils.of(
                        "maxAttempts", writer -> {
                            writer.addDependency(TypeScriptDependency.UTIL_RETRY);
                            writer.addImport("DEFAULT_MAX_ATTEMPTS", "DEFAULT_MAX_ATTEMPTS",
                                    TypeScriptDependency.UTIL_RETRY.packageName);
                            writer.write("DEFAULT_MAX_ATTEMPTS");
                        },
                        "retryMode", writer -> {
                            writer.addDependency(TypeScriptDependency.UTIL_RETRY);
                            writer.addImport("DEFAULT_RETRY_MODE", "DEFAULT_RETRY_MODE",
                                    TypeScriptDependency.UTIL_RETRY.packageName);
                            writer.write(
                                    "(async () => (await defaultConfigProvider()).retryMode || DEFAULT_RETRY_MODE)");
                        }
                );
            case NODE:
                return MapUtils.of(
                        "maxAttempts", writer -> {
                            writer.addDependency(TypeScriptDependency.NODE_CONFIG_PROVIDER);
                            writer.addImport("loadConfig", "loadNodeConfig",
                                    TypeScriptDependency.NODE_CONFIG_PROVIDER.packageName);
                            writer.addImport("NODE_MAX_ATTEMPT_CONFIG_OPTIONS", "NODE_MAX_ATTEMPT_CONFIG_OPTIONS",
                                    TypeScriptDependency.MIDDLEWARE_RETRY.packageName);
                            writer.write("loadNodeConfig(NODE_MAX_ATTEMPT_CONFIG_OPTIONS)");
                        },
                        "retryMode", writer -> {
                            writer.addDependency(TypeScriptDependency.NODE_CONFIG_PROVIDER);
                            writer.addImport("loadConfig", "loadNodeConfig",
                                    TypeScriptDependency.NODE_CONFIG_PROVIDER.packageName);
                            writer.addDependency(TypeScriptDependency.MIDDLEWARE_RETRY);
                            writer.addImport("NODE_RETRY_MODE_CONFIG_OPTIONS", "NODE_RETRY_MODE_CONFIG_OPTIONS",
                                    TypeScriptDependency.MIDDLEWARE_RETRY.packageName);
                            writer.addImport("DEFAULT_RETRY_MODE", "DEFAULT_RETRY_MODE",
                                    TypeScriptDependency.UTIL_RETRY.packageName);
                            writer.openBlock("loadNodeConfig({", "})", () -> {
                                writer.write("...NODE_RETRY_MODE_CONFIG_OPTIONS,");
                                writer.write("default: async () => "
                                             + "(await defaultConfigProvider()).retryMode || DEFAULT_RETRY_MODE,");
                            });
                        }
                );
        default:
                return Collections.emptyMap();
        }
    }
}
