import { CredentialsProviderError } from "@smithy/property-provider";
import { Logger, Provider } from "@smithy/types";

import { getSelectorName } from "./getSelectorName";

// Using Record<string, string | undefined> instead of NodeJS.ProcessEnv, in order to not get type errors in non node environments
export type GetterFromEnv<T> = (env: Record<string, string | undefined>) => T | undefined;

/**
 * Get config value given the environment variable name or getter from
 * environment variable.
 */
export const fromEnv =
  <T = string>(envVarSelector: GetterFromEnv<T>, logger?: Logger): Provider<T> =>
  async () => {
    try {
      const config = envVarSelector(process.env);
      if (config === undefined) {
        throw new Error();
      }
      return config as T;
    } catch (e) {
      throw new CredentialsProviderError(
        e.message || `Not found in ENV: ${getSelectorName(envVarSelector.toString())}`,
        { logger }
      );
    }
  };
