import { CredentialsProviderError } from "@smithy/property-provider";
import { Provider } from "@smithy/types";

import { getSelectorName } from "./getSelectorName";

export interface ClientOptions {
  /**
   * The SigV4 service signing name.
   */
  signingName?: string;
}

// Using Record<string, string | undefined> instead of NodeJS.ProcessEnv, in order to not get type errors in non node environments
export type GetterFromEnv<T> = (env: Record<string, string | undefined>, options?: ClientOptions) => T | undefined;

/**
 * Get config value given the environment variable name or getter from
 * environment variable.
 */
export const fromEnv =
  <T = string>(envVarSelector: GetterFromEnv<T>, options?: ClientOptions): Provider<T> =>
  async () => {
    try {
      const config = envVarSelector(process.env, options);
      if (config === undefined) {
        throw new Error();
      }
      return config as T;
    } catch (e) {
      throw new CredentialsProviderError(
        e.message || `Not found in ENV: ${getSelectorName(envVarSelector.toString())}`
      );
    }
  };
