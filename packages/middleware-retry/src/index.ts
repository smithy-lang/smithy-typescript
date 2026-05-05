/** @deprecated Use @smithy/core/retry instead. */
export {
  DeprecatedAdaptiveRetryStrategy as AdaptiveRetryStrategy,
  DeprecatedStandardRetryStrategy as StandardRetryStrategy,
  CONFIG_MAX_ATTEMPTS,
  CONFIG_RETRY_MODE,
  ENV_MAX_ATTEMPTS,
  ENV_RETRY_MODE,
  NODE_MAX_ATTEMPT_CONFIG_OPTIONS,
  NODE_RETRY_MODE_CONFIG_OPTIONS,
  defaultDelayDecider,
  defaultRetryDecider,
  getOmitRetryHeadersPlugin,
  getRetryAfterHint,
  getRetryPlugin,
  omitRetryHeadersMiddleware,
  omitRetryHeadersMiddlewareOptions,
  resolveRetryConfig,
  retryMiddleware,
  retryMiddlewareOptions,
} from "@smithy/core/retry";
export type {
  DeprecatedAdaptiveRetryStrategyOptions as AdaptiveRetryStrategyOptions,
  DeprecatedStandardRetryStrategyOptions as StandardRetryStrategyOptions,
  RetryInputConfig,
  RetryResolvedConfig,
  PreviouslyResolved,
} from "@smithy/core/retry";
