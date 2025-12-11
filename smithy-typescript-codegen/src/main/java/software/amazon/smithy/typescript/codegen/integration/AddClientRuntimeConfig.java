/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.integration;

import java.nio.file.Paths;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.extensions.DefaultExtensionConfigurationInterface;
import software.amazon.smithy.typescript.codegen.extensions.ExtensionConfigurationInterface;
import software.amazon.smithy.typescript.codegen.extensions.HttpHandlerExtensionConfigurationInterface;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * All clients need to know the max attempt to retry a request and logger instance to print the log.
 *
 * <p>This plugin adds the following config interface fields:
 *
 * <ul>
 *   <li>maxAttempts: Provides value for how many times a request will be made at most in case of
 *       retry.
 *   <li>retryMode: Specifies which retry algorithm to use.
 *   <li>logger: Optional logger for logging debug/info/warn/error.
 * </ul>
 *
 * <p>This plugin adds the following Node runtime specific values:
 *
 * <ul>
 *   <li>maxAttempts: Uses the default maxAttempts provider that checks things like environment
 *       variables and the AWS config file.
 *   <li>retryMode: Specifies which retry algorithm to use.
 *   <li>logger: Sets to empty as logger is passed in client configuration.
 * </ul>
 *
 * <p>This plugin adds the following Browser runtime specific values:
 *
 * <ul>
 *   <li>maxAttempts: Returns default value of 3.
 *   <li>retryMode: Provider which returns DEFAULT_RETRY_MODE.
 *   <li>logger: Sets to empty as logger is passed in client configuration.
 * </ul>
 */
@SmithyInternalApi
public final class AddClientRuntimeConfig implements TypeScriptIntegration {

  @Override
  public void addConfigInterfaceFields(
      TypeScriptSettings settings,
      Model model,
      SymbolProvider symbolProvider,
      TypeScriptWriter writer) {
    writer.addTypeImport("Provider", "__Provider", TypeScriptDependency.SMITHY_TYPES);
    writer.addTypeImport("Logger", "__Logger", TypeScriptDependency.SMITHY_TYPES);

    writer
        .writeDocs("Value for how many times a request will be made at most in case of retry.")
        .write("maxAttempts?: number | __Provider<number>;\n");
    writer
        .writeDocs(
            """
            Specifies which retry algorithm to use.
            @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-smithy-util-retry/Enum/RETRY_MODES/
            """)
        .write("retryMode?: string | __Provider<string>;\n");
    writer
        .writeDocs("Optional logger for logging debug/info/warn/error.")
        .write("logger?: __Logger;\n");
    writer.addRelativeTypeImport(
        "RuntimeExtension", null, Paths.get(".", CodegenUtils.SOURCE_FOLDER, "runtimeExtensions"));
    writer.writeDocs("Optional extensions").write("extensions?: RuntimeExtension[];\n");
  }

  @Override
  public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
      TypeScriptSettings settings,
      Model model,
      SymbolProvider symbolProvider,
      LanguageTarget target) {
    switch (target) {
      case SHARED:
        return MapUtils.of(
            "logger",
            writer -> {
              writer.addImport("NoOpLogger", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
              writer.write("new NoOpLogger()");
            });
      case BROWSER:
        return MapUtils.of(
            "maxAttempts",
                writer -> {
                  writer.addDependency(TypeScriptDependency.UTIL_RETRY);
                  writer.addImport("DEFAULT_MAX_ATTEMPTS", null, TypeScriptDependency.UTIL_RETRY);
                  writer.write("DEFAULT_MAX_ATTEMPTS");
                },
            "retryMode",
                writer -> {
                  writer.addDependency(TypeScriptDependency.UTIL_RETRY);
                  writer.addImport("DEFAULT_RETRY_MODE", null, TypeScriptDependency.UTIL_RETRY);
                  writer.write(
                      "(async () => (await defaultConfigProvider()).retryMode ||"
                          + " DEFAULT_RETRY_MODE)");
                });
      case NODE:
        return MapUtils.of(
            "maxAttempts",
                writer -> {
                  writer.addDependency(TypeScriptDependency.NODE_CONFIG_PROVIDER);
                  writer.addImport(
                      "loadConfig", "loadNodeConfig", TypeScriptDependency.NODE_CONFIG_PROVIDER);
                  writer.addImport(
                      "NODE_MAX_ATTEMPT_CONFIG_OPTIONS",
                      null,
                      TypeScriptDependency.MIDDLEWARE_RETRY);
                  writer.write("loadNodeConfig(NODE_MAX_ATTEMPT_CONFIG_OPTIONS, config)");
                },
            "retryMode",
                writer -> {
                  writer.addDependency(TypeScriptDependency.NODE_CONFIG_PROVIDER);
                  writer.addImport(
                      "loadConfig", "loadNodeConfig", TypeScriptDependency.NODE_CONFIG_PROVIDER);
                  writer.addDependency(TypeScriptDependency.MIDDLEWARE_RETRY);
                  writer.addImport(
                      "NODE_RETRY_MODE_CONFIG_OPTIONS",
                      null,
                      TypeScriptDependency.MIDDLEWARE_RETRY);
                  writer.addImport("DEFAULT_RETRY_MODE", null, TypeScriptDependency.UTIL_RETRY);
                  writer.indent();
                  writer.writeInline(
                      """
                      loadNodeConfig(
                        {
                          ...NODE_RETRY_MODE_CONFIG_OPTIONS,
                          default: async () => (await defaultConfigProvider()).retryMode || DEFAULT_RETRY_MODE,
                        },
                        config
                      )\
                      """);
                  writer.dedent();
                });
      default:
        return Collections.emptyMap();
    }
  }

  @Override
  public List<ExtensionConfigurationInterface> getExtensionConfigurationInterfaces(
      Model model, TypeScriptSettings settings) {
    return List.of(
        new DefaultExtensionConfigurationInterface(),
        new HttpHandlerExtensionConfigurationInterface());
  }
}
