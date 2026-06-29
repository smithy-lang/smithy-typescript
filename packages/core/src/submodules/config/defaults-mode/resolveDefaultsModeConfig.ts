import type { DefaultsMode, ResolvedDefaultsMode } from "@smithy/core/client";
import type { Provider } from "@smithy/types";

import { NODE_REGION_CONFIG_OPTIONS } from "../config-resolver/regionConfig/config";
import { getInstanceMetadataRegion } from "../config-resolver/regionConfig/getInstanceMetadataRegion";
import { loadConfig } from "../node-config-provider/configLoader";
import { memoize } from "../property-provider/memoize";
import { AWS_DEFAULT_REGION_ENV, AWS_EXECUTION_ENV, AWS_REGION_ENV, DEFAULTS_MODE_OPTIONS } from "./constants";
import { NODE_DEFAULTS_MODE_CONFIG_OPTIONS } from "./defaultsModeConfig";

/**
 * @internal
 */
export interface ResolveDefaultsModeConfigOptions {
  defaultsMode?: DefaultsMode | Provider<DefaultsMode>;
  region?: string | Provider<string>;
}

/**
 * Validate the defaultsMode configuration. If the value is set to "auto", it
 * resolves the value to "in-region", "cross-region", or "standard".
 *
 * @default "legacy"
 * @internal
 */
export const resolveDefaultsModeConfig = ({
  region = loadConfig(NODE_REGION_CONFIG_OPTIONS),
  defaultsMode = loadConfig(NODE_DEFAULTS_MODE_CONFIG_OPTIONS),
}: ResolveDefaultsModeConfigOptions = {}): Provider<ResolvedDefaultsMode> =>
  memoize(async () => {
    const mode = typeof defaultsMode === "function" ? await defaultsMode() : defaultsMode;
    switch (mode?.toLowerCase()) {
      case "auto":
        return resolveNodeDefaultsModeAuto(region);
      case "in-region":
      case "cross-region":
      case "mobile":
      case "standard":
      case "legacy":
        return Promise.resolve(mode?.toLocaleLowerCase() as ResolvedDefaultsMode);
      case undefined:
        return Promise.resolve("legacy");
      default:
        throw new Error(
          `Invalid parameter for "defaultsMode", expect ${DEFAULTS_MODE_OPTIONS.join(", ")}, got ${mode}`
        );
    }
  });

const resolveNodeDefaultsModeAuto = async (clientRegion?: string | Provider<string>): Promise<ResolvedDefaultsMode> => {
  if (clientRegion) {
    const resolvedRegion = typeof clientRegion === "function" ? await clientRegion() : clientRegion;
    const inferredRegion = await inferPhysicalRegion();
    if (!inferredRegion) {
      return "standard";
    }
    if (resolvedRegion === inferredRegion) {
      return "in-region";
    } else {
      return "cross-region";
    }
  }
  return "standard";
};

/**
 * Infer the hosting app's physical region.
 */
const inferPhysicalRegion = async (): Promise<string | undefined> => {
  if (process.env[AWS_EXECUTION_ENV] && (process.env[AWS_REGION_ENV] || process.env[AWS_DEFAULT_REGION_ENV])) {
    // We're running in an AWS service environment, so we can trust the region environment variables to be the current
    // region, if they're set
    return process.env[AWS_REGION_ENV] ?? process.env[AWS_DEFAULT_REGION_ENV];
  }
  return getInstanceMetadataRegion();
};
