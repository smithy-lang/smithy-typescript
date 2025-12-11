/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.extensions;

import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.utils.Pair;
import software.amazon.smithy.utils.SmithyInternalApi;

/** An interface class for defining the service client configuration. */
@SmithyInternalApi
public interface ExtensionConfigurationInterface {
  /**
   * Define the interface name.
   *
   * @return Returns the interface name and the corresponding dependency package
   */
  Pair<String, Dependency> name();

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
  Pair<String, Dependency> getExtensionConfigurationFn();

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
  Pair<String, Dependency> resolveRuntimeConfigFn();
}
