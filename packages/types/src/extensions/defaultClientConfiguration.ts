import { getChecksumConfiguration, resolveChecksumRuntimeConfig, type ChecksumConfiguration } from "./checksum";

/**
 * Default client configuration consisting various configurations for modifying a service client
 *
 * @internal
 * @deprecated will be replaced by DefaultExtensionConfiguration.
 */
export interface DefaultClientConfiguration extends ChecksumConfiguration {}

/**
 * @deprecated will be removed for implicit type.
 */
type GetDefaultConfigurationType = (runtimeConfig: any) => DefaultClientConfiguration;

/**
 * Helper function to resolve default client configuration from runtime config
 *
 * @internal
 * @deprecated moving to @smithy/smithy-client.
 */
export const getDefaultClientConfiguration: GetDefaultConfigurationType = (runtimeConfig: any) => {
  return getChecksumConfiguration(runtimeConfig);
};

/**
 * @deprecated will be removed for implicit type.
 */
type ResolveDefaultRuntimeConfigType = (clientConfig: DefaultClientConfiguration) => any;

/**
 * Helper function to resolve runtime config from default client configuration
 *
 * @internal
 * @deprecated moving to @smithy/smithy-client.
 */
export const resolveDefaultRuntimeConfig: ResolveDefaultRuntimeConfigType = (config: DefaultClientConfiguration) => {
  return resolveChecksumRuntimeConfig(config);
};
