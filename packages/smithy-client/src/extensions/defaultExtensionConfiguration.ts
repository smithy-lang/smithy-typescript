import type { DefaultExtensionConfiguration } from "@smithy/types";

import type { PartialChecksumRuntimeConfigType } from "./checksum";
import { getChecksumConfiguration, resolveChecksumRuntimeConfig } from "./checksum";
import type { PartialRetryRuntimeConfigType } from "./retry";
import { getRetryConfiguration, resolveRetryRuntimeConfig } from "./retry";

/**
 * @internal
 */
export type DefaultExtensionRuntimeConfigType = PartialRetryRuntimeConfigType & PartialChecksumRuntimeConfigType;

/**
 * @internal
 *
 * Helper function to resolve default extension configuration from runtime config
 */
export const getDefaultExtensionConfiguration = (runtimeConfig: DefaultExtensionRuntimeConfigType) => {
  return Object.assign(getChecksumConfiguration(runtimeConfig), getRetryConfiguration(runtimeConfig));
};

/**
 * @deprecated use getDefaultExtensionConfiguration
 * @internal
 *
 * Helper function to resolve default extension configuration from runtime config
 */
export const getDefaultClientConfiguration = getDefaultExtensionConfiguration;

/**
 * @internal
 *
 * Helper function to resolve runtime config from default extension configuration
 */
export const resolveDefaultRuntimeConfig = (
  config: DefaultExtensionConfiguration
): DefaultExtensionRuntimeConfigType => {
  return Object.assign(resolveChecksumRuntimeConfig(config), resolveRetryRuntimeConfig(config));
};
