import type { LoadedConfigSelectors } from "@smithy/node-config-provider";
import { booleanSelector, SelectorType } from "@smithy/util-config-provider";

/**
 * @internal
 */
export const ENV_USE_FIPS_ENDPOINT = "AWS_USE_FIPS_ENDPOINT";
/**
 * @internal
 */
export const CONFIG_USE_FIPS_ENDPOINT = "use_fips_endpoint";
/**
 * @internal
 */
export const DEFAULT_USE_FIPS_ENDPOINT = false;

/**
 * Don't delete this, used by older clients.
 * @deprecated replaced by nodeFipsConfigSelectors in newer clients.
 * @internal
 */
export const NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS: LoadedConfigSelectors<boolean> = {
  environmentVariableSelector: (env: NodeJS.ProcessEnv) =>
    booleanSelector(env, ENV_USE_FIPS_ENDPOINT, SelectorType.ENV),
  configFileSelector: (profile) => booleanSelector(profile, CONFIG_USE_FIPS_ENDPOINT, SelectorType.CONFIG),
  default: false,
};

/**
 * @internal
 */
export const nodeFipsConfigSelectors: LoadedConfigSelectors<boolean | undefined> = {
  environmentVariableSelector: (env: NodeJS.ProcessEnv) =>
    booleanSelector(env, ENV_USE_FIPS_ENDPOINT, SelectorType.ENV),
  configFileSelector: (profile) => booleanSelector(profile, CONFIG_USE_FIPS_ENDPOINT, SelectorType.CONFIG),
  default: undefined,
};
