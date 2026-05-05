import type {
  Provider,
  RetryErrorInfo,
  RetryErrorType,
  RetryStrategyV2,
  StandardRetryBackoffStrategy,
  StandardRetryToken,
} from "@smithy/types";

import { DEFAULT_MAX_ATTEMPTS, RETRY_MODES } from "./config";
import { INITIAL_RETRY_TOKENS, NO_RETRY_INCREMENT } from "./constants";
import { DefaultRetryBackoffStrategy } from "./DefaultRetryBackoffStrategy";
import { DefaultRetryToken } from "./DefaultRetryToken";
import { Retry } from "./retries-2026-config";

/**
 * @public
 */
export type StandardRetryStrategyOptions = {
  /**
   * Maximum number of attempts. If set to 1, no retries will be made.
   */
  maxAttempts: number;
  /**
   * When present, overrides the base delay for non-throttling retries.
   */
  baseDelay?: number;
  /**
   * Backoff calculator.
   */
  backoff?: StandardRetryBackoffStrategy;
};

/**
 * Reason for refusing to retry.
 * @internal
 */
const refusal = {
  /**
   * Error is not retryable via classification.
   */
  incompatible: 1,
  /**
   * attempt count exhausted.
   */
  attempts: 2,
  /**
   * capacity exhausted.
   */
  capacity: 3,
} as const;

/**
 * @public
 */
export class StandardRetryStrategy implements RetryStrategyV2 {
  public readonly mode: string = RETRY_MODES.STANDARD;

  private capacity: number = INITIAL_RETRY_TOKENS;
  private readonly retryBackoffStrategy: StandardRetryBackoffStrategy;
  private readonly maxAttemptsProvider: Provider<number>;
  private readonly baseDelay: number;

  public constructor(maxAttempts: number);
  public constructor(maxAttemptsProvider: Provider<number>);
  public constructor(options: StandardRetryStrategyOptions);
  public constructor(arg1: number | Provider<number> | StandardRetryStrategyOptions) {
    if (typeof arg1 === "number") {
      this.maxAttemptsProvider = async () => arg1;
    } else if (typeof arg1 === "function") {
      this.maxAttemptsProvider = arg1;
    } else if (arg1 && typeof arg1 === "object") {
      this.maxAttemptsProvider = async () => arg1.maxAttempts;
      this.baseDelay = arg1.baseDelay!;
      this.retryBackoffStrategy = arg1.backoff!;
    }
    this.maxAttemptsProvider ??= async () => DEFAULT_MAX_ATTEMPTS;
    this.baseDelay ??= Retry.delay();
    this.retryBackoffStrategy ??= new DefaultRetryBackoffStrategy();
  }

  public async acquireInitialRetryToken(retryTokenScope: string): Promise<StandardRetryToken> {
    return new DefaultRetryToken(Retry.delay(), 0, undefined, Retry.v2026 && retryTokenScope.includes(":longpoll"));
  }

  public async refreshRetryTokenForRetry(
    token: StandardRetryToken,
    errorInfo: RetryErrorInfo
  ): Promise<StandardRetryToken> {
    const maxAttempts = await this.getMaxAttempts();

    const retryCode = this.retryCode(token, errorInfo, maxAttempts);
    const shouldRetry = retryCode === 0;
    const isLongPoll = token.isLongPoll?.();

    if (shouldRetry || isLongPoll) {
      const errorType = errorInfo.errorType;
      this.retryBackoffStrategy.setDelayBase(errorType === "THROTTLING" ? Retry.throttlingDelay() : this.baseDelay);

      const delayFromErrorType = this.retryBackoffStrategy.computeNextBackoffDelay(token.getRetryCount());

      let retryDelay = delayFromErrorType;
      if (errorInfo.retryAfterHint instanceof Date) {
        retryDelay = Math.max(
          delayFromErrorType /* lower bound */,
          Math.min(errorInfo.retryAfterHint.getTime() - Date.now(), delayFromErrorType + 5_000 /* upper bound */)
        );
      }

      if (!shouldRetry) {
        /**
         * We only apply additional backoff if `isLongPoll` and the retryCode=3 indicates
         * that capacity is exhausted. Running out of attempts or having a
         * non-retryable error does *not* apply backoff.
         */
        throw Object.assign(new Error("No retry token available"), {
          $backoff: Retry.v2026 && retryCode === refusal.capacity && isLongPoll ? retryDelay : 0,
        });
      } else {
        const capacityCost = this.getCapacityCost(errorType);
        this.capacity -= capacityCost;

        return new DefaultRetryToken(
          retryDelay,
          token.getRetryCount() + 1,
          capacityCost,
          token.isLongPoll?.() ?? false
        );
      }
    }

    throw new Error("No retry token available");
  }

  public recordSuccess(token: StandardRetryToken): void {
    this.capacity = Math.min(INITIAL_RETRY_TOKENS, this.capacity + (token.getRetryCost() ?? NO_RETRY_INCREMENT));
  }

  /**
   * This number decreases when retries are executed and refills when requests or retries succeed.
   * @returns the current available retry capacity.
   */
  public getCapacity(): number {
    return this.capacity;
  }

  /**
   * There is an existing integration which accesses this field.
   * @deprecated
   */
  public async maxAttempts(): Promise<number> {
    return this.maxAttemptsProvider();
  }

  private async getMaxAttempts() {
    try {
      return await this.maxAttemptsProvider();
    } catch (error) {
      console.warn(`Max attempts provider could not resolve. Using default of ${DEFAULT_MAX_ATTEMPTS}`);
      return DEFAULT_MAX_ATTEMPTS;
    }
  }

  /**
   * 0 - OK to retry.
   * 1 - error is not classified as retryable.
   * 2 - attempt count exhausted.
   * 3 - no capacity left (retry tokens exhausted).
   *
   * @returns 0 or the number of the highest priority (lowest integer) reason why retry is not possible.
   */
  private retryCode(
    tokenToRenew: StandardRetryToken,
    errorInfo: RetryErrorInfo,
    maxAttempts: number
  ): 0 | (typeof refusal)[keyof typeof refusal] {
    const attempts = tokenToRenew.getRetryCount() + 1;

    const retryableStatus = this.isRetryableError(errorInfo.errorType) ? 0 : refusal.incompatible;
    const attemptStatus = attempts < maxAttempts ? 0 : refusal.attempts;
    const capacityStatus = this.capacity >= this.getCapacityCost(errorInfo.errorType) ? 0 : refusal.capacity;

    return retryableStatus || attemptStatus || capacityStatus;
  }

  private getCapacityCost(errorType: RetryErrorType) {
    return errorType === Retry.modifiedCostType() ? Retry.throttlingCost() : Retry.cost();
  }

  private isRetryableError(errorType: RetryErrorType): boolean {
    return errorType === "THROTTLING" || errorType === "TRANSIENT";
  }
}
