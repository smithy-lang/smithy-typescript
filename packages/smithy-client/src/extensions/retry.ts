import { Provider, RetryStrategy, RetryStrategyConfiguration, RetryStrategyV2 } from "@smithy/types";

/**
 * @internal
 */
export const getRetryConfiguration = (
  runtimeConfig: Partial<{ retryStrategy: Provider<RetryStrategyV2 | RetryStrategy> }>
) => {
  return {
    _retryStrategy: runtimeConfig.retryStrategy!,
    setRetryStrategy(retryStrategy: Provider<RetryStrategyV2 | RetryStrategy>): void {
      this._retryStrategy = retryStrategy;
    },
    retryStrategy(): Provider<RetryStrategyV2 | RetryStrategy> {
      return this._retryStrategy;
    },
  };
};

/**
 * @internal
 */
export const resolveRetryRuntimeConfig = (retryStrategyConfiguration: RetryStrategyConfiguration) => {
  const runtimeConfig: Partial<Record<string, Provider<RetryStrategyV2 | RetryStrategy>>> = {};
  runtimeConfig.retryStrategy = retryStrategyConfiguration.retryStrategy();
  return runtimeConfig;
};
