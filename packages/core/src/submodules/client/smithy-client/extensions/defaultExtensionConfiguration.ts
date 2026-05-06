import type { DefaultExtensionConfiguration } from "@smithy/types";

import {
  getChecksumConfiguration,
  resolveChecksumRuntimeConfig,
  type PartialChecksumRuntimeConfigType,
} from "./checksum";
import { getRetryConfiguration, resolveRetryRuntimeConfig, type PartialRetryRuntimeConfigType } from "./retry";

/**
 * @internal
 */
export type DefaultExtensionRuntimeConfigType = PartialRetryRuntimeConfigType & PartialChecksumRuntimeConfigType;

/**
 * Helper function to resolve default extension configuration from runtime config
 *
 * @internal
 */
export const getDefaultExtensionConfiguration = (runtimeConfig: DefaultExtensionRuntimeConfigType) => {
  return Object.assign(getChecksumConfiguration(runtimeConfig), getRetryConfiguration(runtimeConfig));
};

/**
 * Helper function to resolve default extension configuration from runtime config
 *
 * @internal
 * @deprecated use getDefaultExtensionConfiguration
 */
export const getDefaultClientConfiguration = getDefaultExtensionConfiguration;

/**
 * Helper function to resolve runtime config from default extension configuration
 *
 * @internal
 */
export const resolveDefaultRuntimeConfig = (
  config: DefaultExtensionConfiguration
): DefaultExtensionRuntimeConfigType => {
  return Object.assign(resolveChecksumRuntimeConfig(config), resolveRetryRuntimeConfig(config));
};
