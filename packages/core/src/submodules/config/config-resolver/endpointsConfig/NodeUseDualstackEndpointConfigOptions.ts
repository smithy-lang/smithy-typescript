import type { LoadedConfigSelectors } from "../../node-config-provider/configLoader";
import { booleanSelector } from "../../util-config-provider/booleanSelector";
import { SelectorType } from "../../util-config-provider/types";

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
