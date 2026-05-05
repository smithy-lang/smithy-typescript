import { normalizeProvider } from "@smithy/core/client";
import type { LoadedConfigSelectors } from "@smithy/core/config";
import type { Logger, Provider, RetryStrategy, RetryStrategyV2 } from "@smithy/types";

import { AdaptiveRetryStrategy } from "../util-retry/AdaptiveRetryStrategy";
import { DEFAULT_MAX_ATTEMPTS, DEFAULT_RETRY_MODE, RETRY_MODES } from "../util-retry/config";
import { StandardRetryStrategy } from "../util-retry/StandardRetryStrategy";

/**
 * @internal
 */
export const ENV_MAX_ATTEMPTS = "AWS_MAX_ATTEMPTS";
/**
 * @internal
 */
export const CONFIG_MAX_ATTEMPTS = "max_attempts";

/**
 * @internal
 */
export const NODE_MAX_ATTEMPT_CONFIG_OPTIONS: LoadedConfigSelectors<number> = {
  environmentVariableSelector: (env) => {
    const value = env[ENV_MAX_ATTEMPTS];
    if (!value) return undefined;
    const maxAttempt = parseInt(value);
    if (Number.isNaN(maxAttempt)) {
      throw new Error(`Environment variable ${ENV_MAX_ATTEMPTS} mast be a number, got "${value}"`);
    }
    return maxAttempt;
  },
  configFileSelector: (profile) => {
    const value = profile[CONFIG_MAX_ATTEMPTS];
    if (!value) return undefined;
    const maxAttempt = parseInt(value);
    if (Number.isNaN(maxAttempt)) {
      throw new Error(`Shared config file entry ${CONFIG_MAX_ATTEMPTS} mast be a number, got "${value}"`);
    }
    return maxAttempt;
  },
  default: DEFAULT_MAX_ATTEMPTS,
};

/**
 * @public
 */
export interface RetryInputConfig {
  /**
   * The maximum number of times requests that encounter retryable failures should be attempted.
   */
  maxAttempts?: number | Provider<number>;
  /**
   * The strategy to retry the request. Using built-in exponential backoff strategy by default.
   */
  retryStrategy?: RetryStrategy | RetryStrategyV2;
}

/**
 * @internal
 */
export interface PreviouslyResolved {
  /**
   * Specifies provider for retry algorithm to use.
   * @internal
   */
  retryMode: string | Provider<string>;

  logger?: Logger;
}

/**
 * @internal
 */
export interface RetryResolvedConfig {
  /**
   * Resolved value for input config {@link RetryInputConfig.maxAttempts}
   */
  maxAttempts: Provider<number>;
  /**
   * Resolved value for input config {@link RetryInputConfig.retryStrategy}
   */
  retryStrategy: Provider<RetryStrategyV2 | RetryStrategy>;

  logger?: Logger;
}

/**
 * @internal
 */
export const resolveRetryConfig = <T>(input: T & PreviouslyResolved & RetryInputConfig): T & RetryResolvedConfig => {
  const { retryStrategy, retryMode } = input;
  const maxAttempts = normalizeProvider(input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

  let controller: Promise<RetryStrategy | RetryStrategyV2> | undefined = retryStrategy
    ? Promise.resolve(retryStrategy)
    : undefined;

  const getDefault = async () =>
    (await normalizeProvider(retryMode)()) === RETRY_MODES.ADAPTIVE
      ? new AdaptiveRetryStrategy(maxAttempts)
      : new StandardRetryStrategy(maxAttempts);

  return Object.assign(input, {
    maxAttempts,
    retryStrategy: () => (controller ??= getDefault()),
  });
};

/**
 * @internal
 */
export const ENV_RETRY_MODE = "AWS_RETRY_MODE";

/**
 * @internal
 */
export const CONFIG_RETRY_MODE = "retry_mode";

/**
 * @internal
 */
export const NODE_RETRY_MODE_CONFIG_OPTIONS: LoadedConfigSelectors<string> = {
  environmentVariableSelector: (env) => env[ENV_RETRY_MODE],
  configFileSelector: (profile) => profile[CONFIG_RETRY_MODE],
  default: DEFAULT_RETRY_MODE,
};
