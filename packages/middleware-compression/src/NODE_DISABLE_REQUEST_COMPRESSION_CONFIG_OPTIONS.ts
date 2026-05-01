import type { LoadedConfigSelectors } from "@smithy/core/config";
import { booleanSelector, SelectorType } from "@smithy/core/config";

/**
 * @internal
 */
export const NODE_DISABLE_REQUEST_COMPRESSION_ENV_NAME = "AWS_DISABLE_REQUEST_COMPRESSION";

/**
 * @internal
 */
export const NODE_DISABLE_REQUEST_COMPRESSION_INI_NAME = "disable_request_compression";

/**
 * @internal
 */
export const DEFAULT_DISABLE_REQUEST_COMPRESSION = false;

/**
 * @internal
 */
export const NODE_DISABLE_REQUEST_COMPRESSION_CONFIG_OPTIONS: LoadedConfigSelectors<boolean> = {
  environmentVariableSelector: (env: NodeJS.ProcessEnv) =>
    booleanSelector(env, NODE_DISABLE_REQUEST_COMPRESSION_ENV_NAME, SelectorType.ENV),
  configFileSelector: (profile) =>
    booleanSelector(profile, NODE_DISABLE_REQUEST_COMPRESSION_INI_NAME, SelectorType.CONFIG),
  default: DEFAULT_DISABLE_REQUEST_COMPRESSION,
};
