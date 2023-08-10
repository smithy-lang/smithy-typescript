import { ChecksumConfiguration, getChecksumConfiguration, resolveChecksumRuntimeConfig } from "./checksum";

/**
 * @internal
 *
 * Default client configuration consisting various configurations for modifying a service client
 */
export interface DefaultClientConfiguration extends ChecksumConfiguration {}

type GetDefaultConfigurationType = (runtimeConfig: any) => DefaultClientConfiguration;

/**
 * @internal
 *
 * Helper function to resolve default client configuration from runtime config
 */
export const getDefaultClientConfiguration: GetDefaultConfigurationType = (runtimeConfig: any) => {
  return {
    ...getChecksumConfiguration(runtimeConfig),
  };
};

type ResolveDefaultRuntimeConfigType = (clientConfig: DefaultClientConfiguration) => any;

/**
 * @internal
 *
 * Helper function to resolve runtime config from default client configuration
 */
export const resolveDefaultRuntimeConfig: ResolveDefaultRuntimeConfigType = (config: DefaultClientConfiguration) => {
  return {
    ...resolveChecksumRuntimeConfig(config),
  };
};
