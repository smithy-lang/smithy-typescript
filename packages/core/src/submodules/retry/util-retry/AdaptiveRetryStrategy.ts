import type { Provider, RetryErrorInfo, RetryStrategyV2, RetryToken, StandardRetryToken } from "@smithy/types";

import { DefaultRateLimiter } from "./DefaultRateLimiter";
import { StandardRetryStrategy, type StandardRetryStrategyOptions } from "./StandardRetryStrategy";
import { RETRY_MODES } from "./config";
import type { RateLimiter } from "./types";

/**
 * Strategy options to be passed to AdaptiveRetryStrategy
 *
 * @public
 */
export interface AdaptiveRetryStrategyOptions extends Partial<StandardRetryStrategyOptions> {
  rateLimiter?: RateLimiter;
}

/**
 * The AdaptiveRetryStrategy is a retry strategy for executing against a very
 * resource constrained set of resources. Care should be taken when using this
 * retry strategy. By default, it uses a dynamic backoff delay based on load
 * currently perceived against the downstream resource and performs circuit
 * breaking to disable retries in the event of high downstream failures using
 * the DefaultRateLimiter.
 *
 * @public
 *
 * @see {@link StandardRetryStrategy}
 * @see {@link DefaultRateLimiter }
 */
export class AdaptiveRetryStrategy implements RetryStrategyV2 {
  public readonly mode: string = RETRY_MODES.ADAPTIVE;
  private rateLimiter: RateLimiter;
  private standardRetryStrategy: StandardRetryStrategy;

  constructor(maxAttemptsProvider: number | Provider<number>, options?: AdaptiveRetryStrategyOptions) {
    const { rateLimiter } = options ?? {};
    this.rateLimiter = rateLimiter ?? new DefaultRateLimiter();

    this.standardRetryStrategy = options
      ? new StandardRetryStrategy({
          maxAttempts: typeof maxAttemptsProvider === "number" ? maxAttemptsProvider : 3,
          ...options,
        })
      : new StandardRetryStrategy(maxAttemptsProvider as Provider<number>);
  }

  public async acquireInitialRetryToken(retryTokenScope: string): Promise<RetryToken> {
    const token = await this.standardRetryStrategy.acquireInitialRetryToken(retryTokenScope);
    await this.rateLimiter.getSendToken();
    return token;
  }

  public async refreshRetryTokenForRetry(
    tokenToRenew: StandardRetryToken,
    errorInfo: RetryErrorInfo
  ): Promise<RetryToken> {
    this.rateLimiter.updateClientSendingRate(errorInfo);
    const token = await this.standardRetryStrategy.refreshRetryTokenForRetry(tokenToRenew, errorInfo);
    // called prior to return in case the token refresh throws (no need to wait in that case).
    await this.rateLimiter.getSendToken();
    return token;
  }

  public recordSuccess(token: StandardRetryToken): void {
    this.rateLimiter.updateClientSendingRate({});
    this.standardRetryStrategy.recordSuccess(token);
  }

  /**
   * There is an existing integration which accesses this field.
   * @deprecated
   */
  public async maxAttemptsProvider(): Promise<number> {
    return this.standardRetryStrategy.maxAttempts();
  }
}
