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

import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.BiPredicate;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.StringUtils;
import software.amazon.smithy.utils.ToSmithyBuilder;

/**
 * Represents a runtime plugin for a client that hooks into various aspects
 * of TypeScript code generation, including adding configuration settings
 * to clients and middleware plugins to both clients and commands.
 *
 * <p>These runtime client plugins are registered through the
 * {@link TypeScriptIntegration} SPI and applied to the code generator at
 * build-time.
 */
public final class RuntimeClientPlugin implements ToSmithyBuilder<RuntimeClientPlugin> {

    private final SymbolReference inputConfig;
    private final SymbolReference resolvedConfig;
    private final SymbolReference resolveFunction;
    private final SymbolReference pluginFunction;
    private final SymbolReference destroyFunction;
    private final BiPredicate<Model, ServiceShape> servicePredicate;
    private final OperationPredicate operationPredicate;

    private RuntimeClientPlugin(Builder builder) {
        inputConfig = builder.inputConfig;
        resolvedConfig = builder.resolvedConfig;
        resolveFunction = builder.resolveFunction;
        pluginFunction = builder.pluginFunction;
        destroyFunction = builder.destroyFunction;
        operationPredicate = builder.operationPredicate;
        servicePredicate = builder.servicePredicate;

        boolean allNull = (inputConfig == null) && (resolvedConfig == null) && (resolveFunction == null);
        boolean allSet = (inputConfig != null) && (resolvedConfig != null) && (resolveFunction != null);
        if (!(allNull || allSet)) {
            throw new IllegalStateException(
                    "If any of inputConfig, resolvedConfig, or resolveFunction are set, then all of "
                    + "inputConfig, resolvedConfig, and resolveFunction must be set: inputConfig: "
                    + inputConfig + ", resolvedConfig: " + resolvedConfig + ", resolveFunction: " + resolveFunction);
        }

        if (destroyFunction != null && resolvedConfig == null) {
            throw new IllegalStateException("resolvedConfig must be set if destroyFunction is set");
        }
    }

    @FunctionalInterface
    public interface OperationPredicate {
        /**
         * Tests if middleware is applied to an individual operation.
         *
         * @param model Model the operation belongs to.
         * @param service Service the operation belongs to.
         * @param operation Operation to test.
         * @return Returns true if middleware should be applied to the operation.
         */
        boolean test(Model model, ServiceShape service, OperationShape operation);
    }

    /**
     * Gets the optionally present symbol reference that points to the
     * <em>Input configuration interface</em> for the plugin.
     *
     * <p>If the plugin has input, then it also must define a
     * <em>resolved interface</em>, and a <em>resolve function</em>.
     *
     * <pre>{@code
     * export interface FooConfigInput {
     *     // ...
     * }
     *
     * export interface FooConfigResolved {
     *     // ...
     * }
     *
     * export function resolveFooConfig(config: FooConfigInput): FooConfigResolved {
     *     return {
     *         ...input,
     *         // more properties...
     *     };
     * }
     * }</pre>
     *
     * @return Returns the optionally present input interface symbol.
     * @see #getResolvedConfig()
     * @see #getResolveFunction()
     */
    public Optional<SymbolReference> getInputConfig() {
        return Optional.ofNullable(inputConfig);
    }

    /**
     * Gets the optionally present symbol reference that points to the
     * <em>Resolved configuration interface</em> for the plugin.
     *
     * <p>If the plugin has a resolved config, then it also must define
     * an <em>input interface</em>, and a <em>resolve function</em>.
     *
     * @return Returns the optionally present resolved interface symbol.
     * @see #getInputConfig()
     * @see #getResolveFunction()
     */
    public Optional<SymbolReference> getResolvedConfig() {
        return Optional.ofNullable(resolvedConfig);
    }

    /**
     * Gets the optionally present symbol reference that points to the
     * function that converts the input configuration type into the
     * resolved configuration type.
     *
     * <p>If the plugin has a resolve function, then it also must define a
     * <em>resolved interface</em> and a <em>resolve function</em>.
     * The referenced function must accept the input type of the plugin
     * as the first positional argument and return the resolved interface
     * as the return value.
     *
     * @return Returns the optionally present resolve function.
     * @see #getInputConfig()
     * @see #getResolvedConfig()
     */
    public Optional<SymbolReference> getResolveFunction() {
        return Optional.ofNullable(resolveFunction);
    }

    /**
     * Gets the optionally present symbol reference that points to the
     * function that injects plugin middleware into the middleware stack
     * of a client or command at runtime.
     *
     * <p>If the plugin has middleware, then the plugin must define a method
     * that takes the plugin's Resolved configuration as the first argument
     * and returns a {@code Pluggable<any, any>}.
     *
     * <pre>{@code
     * export function getFooPlugin(
     *   config: FooConfigResolved
     * ): Pluggable<any, any> => ({
     *   applyToStack: clientStack => {
     *     // add or remove middleware from the stack.
     *   }
     * });
     * }</pre>
     *
     * @return Returns the optionally present plugin function.
     */
    public Optional<SymbolReference> getPluginFunction() {
        return Optional.ofNullable(pluginFunction);
    }

    /**
     * Gets the optionally present symbol reference that points to the
     * function that is used to clean up any resources when a client is
     * destroyed.
     *
     * <p>The referenced method is expected to take a resolved
     * configuration interface and destroy any necessary values
     * (for example, close open connections, deallocate resources, etc).
     *
     * <pre>{@code
     * export function destroyFooConfig(config: FooConfigResolved): void {
     *   // destroy configuration values here...
     * }
     * }</pre>
     *
     * @return Returns the optionally present destroy function.
     */
    public Optional<SymbolReference> getDestroyFunction() {
        return Optional.ofNullable(destroyFunction);
    }

    /**
     * Returns true if this plugin applies to the given service.
     *
     * <p>By default, a plugin applies to all services but not to specific
     * commands. You an configure a plugin to apply only to a subset of
     * services (for example, only apply to a known service or a service
     * with specific traits) or to no services at all (for example, if
     * the plugin is meant to by command-specific and not on every
     * command executed by the service).
     *
     * @param model The model the service belongs to.
     * @param service Service shape to test against.
     * @return Returns true if the plugin is applied to the given service.
     * @see #matchesOperation(Model, ServiceShape, OperationShape)
     */
    public boolean matchesService(Model model, ServiceShape service) {
        return servicePredicate.test(model, service);
    }

    /**
     * Returns true if this plugin applies to the given operation.
     *
     * @param model Model the operation belongs to.
     * @param service Service the operation belongs to.
     * @param operation Operation to test against.
     * @return Returns true if the plugin is applied to the given operation.
     * @see #matchesService(Model, ServiceShape)
     */
    public boolean matchesOperation(Model model, ServiceShape service, OperationShape operation) {
        return operationPredicate.test(model, service, operation);
    }

    public static Builder builder() {
        return new Builder();
    }

    @Override
    public Builder toBuilder() {
        Builder builder = builder()
                .inputConfig(inputConfig)
                .resolvedConfig(resolvedConfig)
                .resolveFunction(resolveFunction)
                .pluginFunction(pluginFunction)
                .destroyFunction(destroyFunction);

        // Set these directly since their setters have mutual side-effects.
        builder.operationPredicate = operationPredicate;
        builder.servicePredicate = servicePredicate;

        return builder;
    }

    @Override
    public String toString() {
        return "RuntimeClientPlugin{"
               + "inputConfig=" + inputConfig
               + ", resolvedConfig=" + resolvedConfig
               + ", resolveFunction=" + resolveFunction
               + ", pluginFunction=" + pluginFunction
               + ", destroyFunction=" + destroyFunction
               + '}';
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        } else if (!(o instanceof RuntimeClientPlugin)) {
            return false;
        }

        RuntimeClientPlugin that = (RuntimeClientPlugin) o;
        return Objects.equals(inputConfig, that.inputConfig)
               && Objects.equals(resolvedConfig, that.resolvedConfig)
               && Objects.equals(resolveFunction, that.resolveFunction)
               && Objects.equals(pluginFunction, that.pluginFunction)
               && Objects.equals(destroyFunction, that.destroyFunction)
               && servicePredicate.equals(that.servicePredicate)
               && operationPredicate.equals(that.operationPredicate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(inputConfig, resolvedConfig, resolveFunction, pluginFunction, destroyFunction);
    }

    /**
     * Builds an {@code RuntimePlugin}.
     */
    public static final class Builder implements SmithyBuilder<RuntimeClientPlugin> {
        private SymbolReference inputConfig;
        private SymbolReference resolvedConfig;
        private SymbolReference resolveFunction;
        private SymbolReference pluginFunction;
        private SymbolReference destroyFunction;
        private BiPredicate<Model, ServiceShape> servicePredicate = (model, service) -> true;
        private OperationPredicate operationPredicate = (model, service, operation) -> false;

        @Override
        public RuntimeClientPlugin build() {
            return new RuntimeClientPlugin(this);
        }

        /**
         * Sets the symbol reference used to configure a client input configuration.
         *
         * <p>If this is set, then both {@link #resolvedConfig} and
         * {@link #resolveFunction} must also be set.
         *
         * @param inputConfig Input configuration symbol to set.
         * @return Returns the builder.
         * @see #getInputConfig()
         */
        public Builder inputConfig(SymbolReference inputConfig) {
            this.inputConfig = inputConfig;
            return this;
        }

        /**
         * Sets the symbol used to configure a client input configuration.
         *
         * <p>If this is set, then both {@link #resolvedConfig} and
         * {@link #resolveFunction} must also be set.
         *
         * @param inputConfig Input configuration symbol to set.
         * @return Returns the builder.
         * @see #getInputConfig()
         */
        public Builder inputConfig(Symbol inputConfig) {
            return inputConfig(SymbolReference.builder().symbol(inputConfig).build());
        }

        /**
         * Sets the symbol refernece used to configure a client resolved configuration.
         *
         * <p>If this is set, then both {@link #resolveFunction} and
         * {@link #inputConfig} must also be set.
         *
         * @param resolvedConfig Resolved configuration symbol to set.
         * @return Returns the builder.
         * @see #getResolvedConfig()
         */
        public Builder resolvedConfig(SymbolReference resolvedConfig) {
            this.resolvedConfig = resolvedConfig;
            return this;
        }

        /**
         * Sets the symbol used to configure a client resolved configuration.
         *
         * <p>If this is set, then both {@link #resolveFunction} and
         * {@link #inputConfig} must also be set.
         *
         * @param resolvedConfig Resolved configuration symbol to set.
         * @return Returns the builder.
         * @see #getResolvedConfig()
         */
        public Builder resolvedConfig(Symbol resolvedConfig) {
            return resolvedConfig(SymbolReference.builder().symbol(resolvedConfig).build());
        }

        /**
         * Sets the symbol reference that is invoked in order to convert the
         * input symbol type to a resolved symbol type.
         *
         * <p>If this is set, then both {@link #resolvedConfig} and
         * {@link #inputConfig} must also be set.
         *
         * @param resolveFunction Function used to convert input to resolved.
         * @return Returns the builder.
         * @see #getResolveFunction()
         */
        public Builder resolveFunction(SymbolReference resolveFunction) {
            this.resolveFunction = resolveFunction;
            return this;
        }

        /**
         * Sets the symbol that is invoked in order to convert the
         * input symbol type to a resolved symbol type.
         *
         * <p>If this is set, then both {@link #resolvedConfig} and
         * {@link #inputConfig} must also be set.
         *
         * @param resolveFunction Function used to convert input to resolved.
         * @return Returns the builder.
         * @see #getResolveFunction()
         */
        public Builder resolveFunction(Symbol resolveFunction) {
            return resolveFunction(SymbolReference.builder().symbol(resolveFunction).build());
        }

        /**
         * Sets a function symbol reference used to configure clients and
         * commands to use a specific middleware function.
         *
         * @param pluginFunction Plugin function symbol to invoke.
         * @return Returns the builder.
         * @see #getPluginFunction()
         */
        public Builder pluginFunction(SymbolReference pluginFunction) {
            this.pluginFunction = pluginFunction;
            return this;
        }

        /**
         * Sets a function symbol used to configure clients and commands to
         * use a specific middleware function.
         *
         * @param pluginFunction Plugin function symbol to invoke.
         * @return Returns the builder.
         * @see #getPluginFunction()
         */
        public Builder pluginFunction(Symbol pluginFunction) {
            return pluginFunction(SymbolReference.builder().symbol(pluginFunction).build());
        }

        /**
         * Sets a function symbol reference to call from a client in the
         * {@code destroy} function of a TypeScript client.
         *
         * <p>The referenced function takes the resolved configuration
         * type as the first argument. {@link #resolvedConfig} must be
         * configured if {@code destroyFunction} is set.
         *
         * @param destroyFunction Function to invoke from a client.
         * @return Returns the builder.
         * @see #getDestroyFunction()
         */
        public Builder destroyFunction(SymbolReference destroyFunction) {
            this.destroyFunction = destroyFunction;
            return this;
        }

        /**
         * Sets a function symbol to call from a client in the {@code destroy}
         * function of a TypeScript client.
         *
         * <p>The referenced function takes the resolved configuration
         * type as the first argument. {@link #resolvedConfig} must be
         * configured if {@code destroyFunction} is set.
         *
         * @param destroyFunction Function to invoke from a client.
         * @return Returns the builder.
         * @see #getDestroyFunction()
         */
        public Builder destroyFunction(Symbol destroyFunction) {
            return destroyFunction(SymbolReference.builder().symbol(destroyFunction).build());
        }

        /**
         * Sets a predicate that determines if the plugin applies to a
         * specific operation.
         *
         * <p>When this method is called, the {@code servicePredicate} is
         * automatically configured to return false for every service.
         *
         * <p>By default, a plugin applies globally to a service, which thereby
         * applies to every operation when the middleware stack is copied.
         *
         * @param operationPredicate Operation matching predicate.
         * @return Returns the builder.
         * @see #servicePredicate(BiPredicate)
         */
        public Builder operationPredicate(OperationPredicate operationPredicate) {
            this.operationPredicate = Objects.requireNonNull(operationPredicate);
            servicePredicate = (model, service) -> false;
            return this;
        }

        /**
         * Configures a predicate that makes a plugin only apply to a set of
         * operations that match one or more of the set of given shape names,
         * and ensures that the plugin is not applied globally to services.
         *
         * <p>By default, a plugin applies globally to a service, which thereby
         * applies to every operation when the middleware stack is copied.
         *
         * @param operationNames Set of operation names.
         * @return Returns the builder.
         */
        public Builder appliesOnlyToOperations(Set<String> operationNames) {
            operationPredicate((model, service, operation) -> operationNames.contains(operation.getId().getName()));
            return servicePredicate((model, service) -> false);
        }

        /**
         * Configures a predicate that applies the plugin to a service if the
         * predicate matches a given model and service.
         *
         * <p>When this method is called, the {@code operationPredicate} is
         * automatically configured to return false for every operation,
         * causing the plugin to only apply to services and not to individual
         * operations.
         *
         * <p>By default, a plugin applies globally to a service, which
         * thereby applies to every operation when the middleware stack is
         * copied. Setting a custom service predicate is useful for plugins
         * that should only be applied to specific services or only applied
         * at the operation level.
         *
         * @param servicePredicate Service predicate.
         * @return Returns the builder.
         * @see #operationPredicate(OperationPredicate)
         */
        public Builder servicePredicate(BiPredicate<Model, ServiceShape> servicePredicate) {
            this.servicePredicate = Objects.requireNonNull(servicePredicate);
            operationPredicate = (model, service, operation) -> false;
            return this;
        }

        /**
         * Configures various aspects of the builder based on naming conventions
         * defined by the provided {@link Convention} values.
         *
         * <p>If no {@code conventions} are provided, a default value of
         * {@link Convention#HAS_CONFIG} and {@link Convention#HAS_MIDDLEWARE}
         * is used.
         *
         * @param dependency Dependency to pull the package name and version from.
         * @param pluginName The name of the plugin that is used when generating
         *   symbol names for each {@code convention}. (for example, "Foo").
         * @param conventions Conventions to use when configuring the builder.
         * @return Returns the builder.
         */
        public Builder withConventions(SymbolDependency dependency, String pluginName, Convention... conventions) {
            return withConventions(dependency.getPackageName(), dependency.getVersion(), pluginName, conventions);
        }

        /**
         * Configures various aspects of the builder based on naming conventions
         * defined by the provided {@link Convention} values.
         *
         * <p>If no {@code conventions} are provided, a default value of
         * {@link Convention#HAS_CONFIG} and {@link Convention#HAS_MIDDLEWARE}
         * is used.
         *
         * @param packageName The name of the package to use as an import and
         *   add as a dependency for each generated symbol
         *   (for example, "foo/baz").
         * @param version The version number to use in the symbol dependencies.
         *   (for example, "1.0.0").
         * @param pluginName The name of the plugin that is used when generating
         *   symbol names for each {@code convention}. (for example, "Foo").
         * @param conventions Conventions to use when configuring the builder.
         * @return Returns the builder.
         */
        public Builder withConventions(
                String packageName,
                String version,
                String pluginName,
                Convention... conventions
        ) {
            pluginName = StringUtils.capitalize(pluginName);

            if (conventions.length == 0) {
                conventions = Convention.DEFAULT;
            }

            for (Convention convention : conventions) {
                switch (convention) {
                    case HAS_CONFIG:
                        inputConfig(Convention.createSymbol(packageName, version, pluginName + "InputConfig"));
                        resolvedConfig(Convention.createSymbol(packageName, version, pluginName + "ResolvedConfig"));
                        resolveFunction(Convention.createSymbol(
                                packageName, version, "resolve" + pluginName + "Config"));
                        break;
                    case HAS_MIDDLEWARE:
                        pluginFunction(Convention.createSymbol(packageName, version, "get" + pluginName + "Plugin"));
                        break;
                    case HAS_DESTROY:
                        destroyFunction(Convention.createSymbol(packageName, version, "destroy" + pluginName));
                        break;
                    default:
                        throw new UnsupportedOperationException("Unexpected switch case: " + convention);
                }
            }

            return this;
        }
    }

    /**
     * Conventions used in {@link Builder#withConventions}.
     */
    public enum Convention {
        /**
         * Whether or not to generate a configuration Input type, Resolved type,
         * and resolveConfig function.
         *
         * <p>Passing this enum to {@link Builder#withConventions} will cause
         * the client to resolve configuration using a function named
         * {@code "resolve" + pluginName + "Config"} (e.g., "resolveFooConfig"),
         * use an input type named {@code pluginName + "InputConfig"}
         * (e.g., "FooInputConfig"), and a resolved type named
         * {@code pluginName + "ResolvedConfig"} (e.g., "FooResolvedConfig").
         *
         * @see #getInputConfig()
         * @see #getResolvedConfig()
         * @see #getResolveFunction()
         */
        HAS_CONFIG,

        /**
         * Whether or not the plugin applies middleware.
         *
         * <p>Passing this enum to {@link Builder#withConventions} will
         * cause matching clients and commands to call a function name
         * {@code "get" + pluginName + "Plugin"} to apply middleware
         * (e.g., "getFooPlugin"). The referenced function is expected
         * to accept a resolved configuration type and return a
         * TypeScript {@code Pluggable}.
         *
         * @see #getPluginFunction()
         */
        HAS_MIDDLEWARE,

        /**
         * Whether or not the plugin has a destroy method.
         *
         * <p>Passing this enum to {@code withConventions} will cause matching
         * clients to invoke a method named {@code "destroy" + pluginName}
         * in the {@code destroy} method of the client (e.g., "destroyFoo").
         * The referenced function is expected to accept the resolved
         * configuration type of the plugin.
         *
         * @see #getDestroyFunction()
         */
        HAS_DESTROY;

        private static final Convention[] DEFAULT = {HAS_CONFIG, HAS_MIDDLEWARE};

        private static Symbol createSymbol(String packageName, String version, String name) {
            return Symbol.builder()
                    .namespace(packageName, "/")
                    .name(name)
                    .addDependency(TypeScriptDependency.NORMAL_DEPENDENCY, packageName, version)
                    .build();
        }
    }
}
