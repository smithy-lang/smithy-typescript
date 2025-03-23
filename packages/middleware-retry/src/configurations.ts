import { LoadedConfigSelectors } from "@smithy/node-config-provider";
import { Provider, RetryStrategy, RetryStrategyV2 } from "@smithy/types";
import { normalizeProvider } from "@smithy/util-middleware";
import {
  AdaptiveRetryStrategy,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_MODE,
  RETRY_MODES,
  StandardRetryStrategy,
} from "@smithy/util-retry";

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
}

/**
 * @internal
 */
export const resolveRetryConfig = <T>(input: T & PreviouslyResolved & RetryInputConfig): T & RetryResolvedConfig => {
  const { retryStrategy, retryMode: _retryMode, maxAttempts: _maxAttempts } = input;
  const maxAttempts = normalizeProvider(_maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

  return Object.assign(input, {
    maxAttempts,
    retryStrategy: async () => {
      if (retryStrategy) {
        return retryStrategy;
      }
      const retryMode = await normalizeProvider(_retryMode)();
      if (retryMode === RETRY_MODES.ADAPTIVE) {
        return new AdaptiveRetryStrategy(maxAttempts);
      }
      return new StandardRetryStrategy(maxAttempts);
    },
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
