import type { LoadedConfigSelectors } from "@smithy/node-config-provider";
import { booleanSelector, SelectorType } from "@smithy/util-config-provider";

/**
 * @internal
 */
export const ENV_USE_DUALSTACK_ENDPOINT = "AWS_USE_DUALSTACK_ENDPOINT";
/**
 * @internal
 */
export const CONFIG_USE_DUALSTACK_ENDPOINT = "use_dualstack_endpoint";
/**
 * @internal
 */
export const DEFAULT_USE_DUALSTACK_ENDPOINT = false;

/**
 * Don't delete this, used by older clients.
 * @deprecated replaced by nodeDualstackConfigSelectors in newer clients.
 * @internal
 */
export const NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS: LoadedConfigSelectors<boolean> = {
  environmentVariableSelector: (env: NodeJS.ProcessEnv) =>
    booleanSelector(env, ENV_USE_DUALSTACK_ENDPOINT, SelectorType.ENV),
  configFileSelector: (profile) => booleanSelector(profile, CONFIG_USE_DUALSTACK_ENDPOINT, SelectorType.CONFIG),
  default: false,
};

/**
 * @internal
 */
export const nodeDualstackConfigSelectors: LoadedConfigSelectors<boolean | undefined> = {
  environmentVariableSelector: (env: NodeJS.ProcessEnv) =>
    booleanSelector(env, ENV_USE_DUALSTACK_ENDPOINT, SelectorType.ENV),
  configFileSelector: (profile) => booleanSelector(profile, CONFIG_USE_DUALSTACK_ENDPOINT, SelectorType.CONFIG),
  default: undefined,
};
