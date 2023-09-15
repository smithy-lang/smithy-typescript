import { chain, memoize } from "@smithy/property-provider";
import type { Provider } from "@smithy/types";

import type { GetterFromEnv } from "./fromEnv";
import { fromEnv } from "./fromEnv";
import type { GetterFromConfig, SharedConfigInit } from "./fromSharedConfigFiles";
import { fromSharedConfigFiles } from "./fromSharedConfigFiles";
import type { FromStaticConfig } from "./fromStatic";
import { fromStatic } from "./fromStatic";

export type LocalConfigOptions = SharedConfigInit;

export interface LoadedConfigSelectors<T> {
  /**
   * A getter function getting the config values from all the environment
   * variables.
   */
  environmentVariableSelector: GetterFromEnv<T>;
  /**
   * A getter function getting config values associated with the inferred
   * profile from shared INI files
   */
  configFileSelector: GetterFromConfig<T>;
  /**
   * Default value or getter
   */
  default: FromStaticConfig<T>;
}

export const loadConfig = <T = string>(
  { environmentVariableSelector, configFileSelector, default: defaultValue }: LoadedConfigSelectors<T>,
  configuration: LocalConfigOptions = {}
): Provider<T> =>
  memoize(
    chain(
      fromEnv(environmentVariableSelector),
      fromSharedConfigFiles(configFileSelector, configuration),
      fromStatic(defaultValue)
    )
  );
