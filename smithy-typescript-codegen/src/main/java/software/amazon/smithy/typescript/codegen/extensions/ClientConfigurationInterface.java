/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

package software.amazon.smithy.typescript.codegen.extensions;

import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * An interface class for defining the service client configuration.
 */
@SmithyInternalApi
public interface ClientConfigurationInterface {
    /**
     * Define the dependency package where the interface and its related functions are defined in.
     *
     * @return Returns a dependency instance
     */
    Dependency dependency();

    /**
     * Define the interface name.
     *
     * @return Returns an interface name
     */
    String name();

    /**
     * Define a function that returns an object instance that implements the interface.
     *
     * <pre>{@code
     * interface TimeoutClientConfiguration {
     *   setTimeout(timeout: number): void;
     *   timeout(): timeout;
     * }
     *
     * const getTimeoutClientConfigurationFn = (runtimeConfig: any) => {
     *     let timeout: number = 100;
     *     if (runtimeConfig.timeout !== undefined) {
     *         timeout = runtimeConfig.timeout;
     *     }
     *
     *     const clientConfiguration: TimeoutClientConfiguration = {
     *         _timeout: timeout,
     *         setTimeout: function(timeout: number): void {
     *             this._timeout = timeout;
     *         },
     *         timeout: function(): number {
     *             return this._timeout;
     *         }
     *     }
     *
     *     return clientConfiguration;
     * }
     *
     * }</pre>
     *
     * @return Returns a typescript function name
     */
    String getClientConfigurationFn();

    /**
     * Define a function that returns an object instance that implements the interface.
     *
     * <pre>{@code
     * interface TimeoutClientConfiguration {
     *   setTimeout(timeout: number): void;
     *   timeout(): timeout;
     * }
     *
     * export const resolveTimeoutRuntimeConfigFn = (clientConfig: TimeoutClientConfiguration) => {
     *     const runtimeConfig: any = {
     *        timeout: clientConfig.timeout()
     *     };
     *
     *     return runtimeConfig;
     * }
     *
     * }</pre>
     *
     * @return Returns a typescript function name
     */
    String resolveRuntimeConfigFn();
}
