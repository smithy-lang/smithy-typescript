import { RetryStrategyV2 } from "../retry";
import { Provider, RetryStrategy } from "../util";

/**
 * @internal
 */
export interface RetryStrategyConfiguration {
  setRetryStrategy(retryStrategy: Provider<RetryStrategyV2 | RetryStrategy>): void;
  retryStrategy(): Provider<RetryStrategyV2 | RetryStrategy>;
}
