/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.SmithyIntegration;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenContext;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.extensions.ClientConfigurationInterface;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Java SPI for customizing TypeScript code generation, registering
 * new protocol code generators, renaming shapes, modifying the model,
 * adding custom code, etc.
 */
@SmithyUnstableApi
public interface TypeScriptIntegration
        extends SmithyIntegration<TypeScriptSettings, TypeScriptWriter, TypeScriptCodegenContext> {

    /**
     * Gets a list of plugins to apply to the generated client.
     *
     * @return Returns the list of RuntimePlugins to apply to the client.
     */
    default List<RuntimeClientPlugin> getClientPlugins() {
        return Collections.emptyList();
    }

    /**
     * Gets a list of protocol generators to register.
     *
     * @return Returns the list of protocol generators to register.
     */
    default List<ProtocolGenerator> getProtocolGenerators() {
        return Collections.emptyList();
    }

    /**
     * Adds additional client config interface fields.
     *
     * <p>Implementations of this method are expected to add fields to the
     * "ClientDefaults" interface of a generated client. This interface
     * contains fields that are either statically generated from
     * a model or are dependent on the runtime that a client is running in.
     * Implementations are expected to write interface field names and
     * their type signatures, each followed by a semicolon (;). Any number
     * of fields can be added, and any {@link Symbol} or
     * {@link SymbolReference} objects that are written to the writer are
     * automatically imported, and any of their contained
     * {@link SymbolDependency} values are automatically added to the
     * generated {@code package.json} file.
     *
     * <p>For example, the following code adds two fields to a client:
     *
     * <pre>
     * {@code
     * public final class MyIntegration implements TypeScriptIntegration {
     *     public void addConfigInterfaceFields(
     *             TypeScriptSettings settings,
     *             Model model,
     *             SymbolProvider symbolProvider,
     *             TypeScriptWriter writer
     *     ) {
     *         writer.writeDocs("The docs for foo...");
     *         writer.write("foo?: string;"); // Note the trailing semicolon!
     *
     *         writer.writeDocs("The docs for bar...");
     *         writer.write("bar?: string;");
     *     }
     * }
     * }</pre>
     *
     * @param settings Settings used to generate.
     * @param model Model to generate from.
     * @param symbolProvider Symbol provider used for codegen.
     * @param writer TypeScript writer to write to.
     */
    default void addConfigInterfaceFields(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer
    ) {
        // pass
    }

    /**
     * Adds additional runtime-specific or shared client config values.
     *
     * <p>Implementations of this method are expected to add values to
     * a runtime-specific or shared configuration object that is used to
     * provide values for a "ClientDefaults" interface. This method is
     * invoked for every supported {@link LanguageTarget}. Implementations are
     * expected to branch on the provided {@code LanguageTarget} and add
     * the appropriate default values and imports, each followed by a
     * (,). Any number of key-value pairs can be added, and any {@link Symbol}
     * or {@link SymbolReference} objects that are written to the writer are
     * automatically imported, and any of their contained
     * {@link SymbolDependency} values are automatically added to the
     * generated {@code package.json} file.
     *
     * <p>For example, the following code adds two values for both the
     * node and browser targets and ignores the SHARED target:
     *
     * <pre>
     * {@code
     * public final class MyIntegration implements TypeScriptIntegration {
     *
     *     private static final Logger LOGGER = Logger.getLogger(MyIntegration.class.getName());
     *
     *     public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
     *             TypeScriptSettings settings,
     *             Model model,
     *             SymbolProvider symbolProvider,
     *             LanguageTarget target
     *     ) {
     *         // This is a static value that is added to every generated
     *         // runtimeConfig file.
     *         Map<String, Consumer<TypeScriptWriter>> config = new HashMap<>();
     *         config.put("foo", writer -> {
     *            writer.write("some static value");
     *         });
     *
     *         switch (target) {
     *             case NODE:
     *                 config.put("bar", writer -> {
     *                     writer.write("(() => someNodeValue)"); // Note the parenthesis surrounding arrow functions
     *                 });
     *                 break;
     *             case BROWSER:
     *                 config.put("bar", writer -> {
     *                     writer.write("someBrowserValue");
     *                 });
     *                 break;
     *             case SHARED:
     *                 break;
     *             default:
     *                 LOGGER.warn("Unknown target: " + target);
     *         }
     *         return config;
     *     }
     * }
     * }</pre>
     *
     * <p>The following code adds a value to the runtimeConfig.shared.ts file
     * so that it used on all platforms. It pulls a trait value from the
     * service being generated and adds it to the client configuration. Note
     * that a corresponding entry needs to be added to
     * {@link #addConfigInterfaceFields} to make TypeScript aware of the
     * property.
     *
     * <pre>
     * {@code
     * public final class MyIntegration2 implements TypeScriptIntegration {
     *     public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
     *             TypeScriptSettings settings,
     *             Model model,
     *             SymbolProvider symbolProvider,
     *             LanguageTarget target
     *     ) {
     *         if (target == LanguageTarget.SHARED) {
     *             return MapUtils.of("someTraitValue", writer -> {
     *                 String someTraitValue = settings.getModel(model).getTrait(SomeTrait.class)
     *                             .map(SomeTrait::getValue)
     *                             .orElse("");
     *                 writer.write(someTraitValue);
     *             });
     *         }
     *     }
     * }
     * }</pre>
     *
     * @param settings Settings used to generate.
     * @param model Model to generate from.
     * @param symbolProvider Symbol provider used for codegen.
     * @param target The TypeScript language target.
     * @return Returns a map of config property name and a consumer function with TypeScriptWriter parameter.
     */
    default Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            LanguageTarget target
    ) {
         return Collections.emptyMap();
    }

    /**
     * Define a list of client configuration interfaces
     *
     * A client configuration interface contains settings that modify a service client.
     *  The client configuration interface enables configuring timeouts, retry strategy, etc for the client.
     *
     * Multiple interfaces are used to define the client configuration. For example:
     *
     * <pre>{@code
     * interface ChecksumConfig {
     *   addChecksumAlgorithm(algo: ChecksumAlgorithm): void;
     *   checksumAlgorithms(): ChecksumAlgorithm[];
     * }
     *
     * interface RetryConfig {
     *   setRetryStrategy(algo: RetryStrategy): void;
     *   retryStrategy(): RetryStrategy;
     * }
     *
     * interface ServiceClientConfiguration extends ChecksumConfig, RetryConfig {
     * }
     * }</pre>
     *
     * During code-generation, smithy-typescript will aggregate the interfaces and create a single client configuration.
     *
     * @return list of client configuration interface
     */
    default List<ClientConfigurationInterface> getClientConfigurationInterfaces() {
        return Collections.emptyList();
    }
}
