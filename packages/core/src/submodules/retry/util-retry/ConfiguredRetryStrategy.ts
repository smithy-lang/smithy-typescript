import type { Provider, RetryBackoffStrategy, RetryStrategyV2 } from "@smithy/types";

import { StandardRetryStrategy } from "./StandardRetryStrategy";
import { Retry } from "./retries-2026-config";

/**
 * This extension of the StandardRetryStrategy allows customizing the
 * backoff computation.
 *
 * @public
 */
export class ConfiguredRetryStrategy extends StandardRetryStrategy implements RetryStrategyV2 {
  private readonly computeNextBackoffDelay: (attempt: number) => number;

  /**
   * @param maxAttempts - the maximum number of retry attempts allowed.
   *                      e.g., if set to 3, then 4 total requests are possible.
   * @param computeNextBackoffDelay - a millisecond delay for each retry or a function that takes the retry attempt
   *                                  and returns the delay.
   *
   * @example exponential backoff.
   * ```js
   * new Client({
   *   retryStrategy: new ConfiguredRetryStrategy(3, (attempt) => attempt ** 2)
   * });
   * ```
   * @example constant delay.
   * ```js
   * new Client({
   *   retryStrategy: new ConfiguredRetryStrategy(3, 2000)
   * });
   * ```
   */
  public constructor(
    maxAttempts: number | Provider<number>,
    computeNextBackoffDelay: number | RetryBackoffStrategy["computeNextBackoffDelay"] = Retry.delay()
  ) {
    super(typeof maxAttempts === "function" ? maxAttempts : async () => maxAttempts);
    if (typeof computeNextBackoffDelay === "number") {
      this.computeNextBackoffDelay = () => computeNextBackoffDelay;
    } else {
      this.computeNextBackoffDelay = computeNextBackoffDelay;
    }
    this.retryBackoffStrategy.computeNextBackoffDelay = (completedAttempt: number): number => {
      // Internally the computation is against the retry which had just completed.
      // when calling the user-provided function we give the attempt number that will next occur.
      const nextAttempt = completedAttempt + 1;
      return this.computeNextBackoffDelay(nextAttempt);
    };
  }
}
