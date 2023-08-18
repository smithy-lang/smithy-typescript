import type { DefaultClientConfiguration } from "@smithy/types";

import { getChecksumConfiguration, resolveChecksumRuntimeConfig } from "./checksum";

/**
 * @internal
 */
export type DefaultExtensionConfigType = Parameters<typeof getChecksumConfiguration>[0];

/**
 * @internal
 *
 * Helper function to resolve default client configuration from runtime config
 */
export const getDefaultClientConfiguration = (runtimeConfig: DefaultExtensionConfigType) => {
  return {
    ...getChecksumConfiguration(runtimeConfig),
  };
};

/**
 * @internal
 *
 * Helper function to resolve runtime config from default client configuration
 */
export const resolveDefaultRuntimeConfig = (config: DefaultClientConfiguration) => {
  return {
    ...resolveChecksumRuntimeConfig(config),
  };
};
