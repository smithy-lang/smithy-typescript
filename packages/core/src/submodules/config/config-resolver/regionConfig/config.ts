import type { LoadedConfigSelectors, LocalConfigOptions } from "../../node-config-provider/configLoader";
import { getInstanceMetadataRegion } from "./getInstanceMetadataRegion";

/**
 * @internal
 */
export const REGION_ENV_NAME = "AWS_REGION";
/**
 * @internal
 */
export const REGION_INI_NAME = "region";

/**
 * @internal
 */
export const NODE_REGION_CONFIG_OPTIONS = {
  environmentVariableSelector: (env) => env[REGION_ENV_NAME],
  configFileSelector: (profile) => profile[REGION_INI_NAME],
  default: async () => {
    const region = await getInstanceMetadataRegion();
    if (region) {
      return region;
    }
    throw new Error("Region is missing");
  },
} satisfies LoadedConfigSelectors<string>;

/**
 * @internal
 */
export const NODE_REGION_CONFIG_FILE_OPTIONS = {
  preferredFile: "credentials",
} satisfies LocalConfigOptions;
