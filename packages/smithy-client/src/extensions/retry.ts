import { Provider, RetryStrategy, RetryStrategyConfiguration, RetryStrategyV2 } from "@smithy/types";

/**
 * @internal
 */
export type PartialRetryRuntimeConfigType = Partial<{ retryStrategy: Provider<RetryStrategyV2 | RetryStrategy> }>;

/**
 * @internal
 */
export const getRetryConfiguration = (runtimeConfig: PartialRetryRuntimeConfigType) => {
  let _retryStrategy = runtimeConfig.retryStrategy!;
  return {
    setRetryStrategy(retryStrategy: Provider<RetryStrategyV2 | RetryStrategy>): void {
      _retryStrategy = retryStrategy;
    },
    retryStrategy(): Provider<RetryStrategyV2 | RetryStrategy> {
      return _retryStrategy;
    },
  };
};

/**
 * @internal
 */
export const resolveRetryRuntimeConfig = (
  retryStrategyConfiguration: RetryStrategyConfiguration
): PartialRetryRuntimeConfigType => {
  const runtimeConfig: PartialRetryRuntimeConfigType = {};
  runtimeConfig.retryStrategy = retryStrategyConfiguration.retryStrategy();
  return runtimeConfig;
};
