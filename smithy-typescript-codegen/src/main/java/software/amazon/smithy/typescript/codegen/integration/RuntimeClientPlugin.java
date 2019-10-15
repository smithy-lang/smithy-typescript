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
import java.util.Set;
import software.amazon.smithy.codegen.core.SymbolReference;

/**
 * Represents a runtime plugin.
 *
 * <p>These runtime plugins are found and applied at runtime to generated
 * clients and servers.
 *
 * <p>Plugins are assumed to take the form of a namespace named after the
 * plugin, with optional features based on feature flags defined in this
 * interface.
 *
 * <p>If the plugin has configuration (that is, {@link #hasConfig()} returns
 * true, then the plugin must define a {@code Input} and {@code Resolved}
 * interface.
 *
 * <p>If the plugin has middleware (that is, {@link #hasMiddleware()} returns
 * true, then the plugin must define a method that returns the middleware
 * of the plugin to apply to a middleware stack.
 *
 * <p>If the plugin needs custom logic when it is destroyed (that is,
 * {@link #hasDestroy()} returns true, then the plugin must define a
 * {@code destroy} method that takes the client as input.
 */
public interface RuntimeClientPlugin {
    /**
     * Provides the name, namespace, any required imports, and any required
     * dependencies of the plugin.
     *
     * @return Returns the symbol used to reference the plugin.
     */
    SymbolReference getSymbol();

    /**
     * Returns true if the plugin has configuration to resolve.
     *
     * @return Returns true if there is configuration.
     */
    boolean hasConfig();

    /**
     * Returns true if the plugin has middleware to add to the middleware stack.
     *
     * @return Returns true if there is middleware.
     */
    boolean hasMiddleware();

    /**
     * Returns true if the plugin has state that needs to be destroyed when the
     * client is destroyed.
     *
     * @return Returns true if there is a destroy method.
     */
    default boolean hasDestroy() {
        return false;
    }

    /**
     * Returns the list of operations that this customization applies to.
     *
     * <p>An empty return value (the default) means that the plugin applies
     * to the client and therefore all commands.
     *
     * @return Returns the names of the operations the customization applies to.
     */
    default Set<String> getOperationNames() {
        return Collections.emptySet();
    }
}
