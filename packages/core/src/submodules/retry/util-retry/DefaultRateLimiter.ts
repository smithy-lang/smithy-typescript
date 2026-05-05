import type { RetryErrorInfo } from "@smithy/types";

import { isThrottlingError } from "../service-error-classification/service-error-classification";
import type { RateLimiter } from "./types";

/**
 * @public
 */
export interface DefaultRateLimiterOptions {
  /**
   * Coefficient for controlling how aggressively the rate decreases on throttle.
   * @defaultValue 0.7
   */
  beta?: number;
  /**
   * Minimum token bucket capacity in adaptive-tokens.
   * @defaultValue 1
   */
  minCapacity?: number;
  /**
   * Minimum fill rate in adaptive-tokens per second.
   * @defaultValue 0.5
   */
  minFillRate?: number;
  /**
   * Scale constant used in the cubic rate calculation.
   * @defaultValue 0.4
   */
  scaleConstant?: number;
  /**
   * Smoothing factor for the exponential moving average of the measured send rate.
   * @defaultValue 0.8
   */
  smooth?: number;
}

/**
 * @public
 */
export class DefaultRateLimiter implements RateLimiter {
  /**
   * Only used in testing.
   */
  private static setTimeoutFn = setTimeout;

  // User configurable constants
  private readonly beta: number;
  private readonly minCapacity: number;
  private readonly minFillRate: number;
  private readonly scaleConstant: number;
  private readonly smooth: number;

  /**
   * Whether adaptive retry rate limiting is active.
   * Remains `false` until a throttling error is detected.
   */
  private enabled = false;
  /**
   * Current number of available adaptive-tokens. When exhausted, requests wait based on fill rate.
   */
  private availableTokens = 0;
  /**
   * The most recent maximum fill rate in adaptive-tokens per second, recorded at the last throttle event.
   */
  private lastMaxRate = 0;
  /**
   * Smoothed measured send rate in requests per second.
   */
  private measuredTxRate = 0;
  /**
   * Number of requests observed in the current measurement time bucket.
   */
  private requestCount = 0;

  /**
   * Current token bucket fill rate in adaptive-tokens per second. Defaults to {@link minFillRate}.
   */
  private fillRate: number;
  /**
   * Timestamp in seconds of the most recent throttle event.
   */
  private lastThrottleTime: number;
  /**
   * Timestamp in seconds of the last token bucket refill.
   */
  private lastTimestamp = 0;
  /**
   * The time bucket (in seconds) used for measuring the send rate.
   */
  private lastTxRateBucket: number;
  /**
   * Maximum token bucket capacity in adaptive-tokens. Defaults to {@link minCapacity}.
   * Updated in {@link updateTokenBucketRate} to match the new fill rate, floored by {@link minCapacity}.
   */
  private maxCapacity: number;
  /**
   * Calculated time window in seconds used in the cubic rate recovery function.
   */
  private timeWindow = 0;

  public constructor(options?: DefaultRateLimiterOptions) {
    this.beta = options?.beta ?? 0.7;
    this.minCapacity = options?.minCapacity ?? 1;
    this.minFillRate = options?.minFillRate ?? 0.5;
    this.scaleConstant = options?.scaleConstant ?? 0.4;
    this.smooth = options?.smooth ?? 0.8;

    this.lastThrottleTime = this.getCurrentTimeInSeconds();
    this.lastTxRateBucket = Math.floor(this.getCurrentTimeInSeconds());

    this.fillRate = this.minFillRate;
    this.maxCapacity = this.minCapacity;
  }

  public async getSendToken() {
    return this.acquireTokenBucket(1);
  }

  public updateClientSendingRate(response: any) {
    /**
     * New fill rate in adaptive-tokens per second, derived from
     * {@link cubicThrottle} on throttle or {@link cubicSuccess} otherwise.
     */
    let calculatedRate: number;
    this.updateMeasuredRate();

    const retryErrorInfo = response as RetryErrorInfo;
    const isThrottling =
      retryErrorInfo?.errorType === "THROTTLING" || isThrottlingError(retryErrorInfo?.error ?? response);

    if (isThrottling) {
      const rateToUse = !this.enabled ? this.measuredTxRate : Math.min(this.measuredTxRate, this.fillRate);
      this.lastMaxRate = rateToUse;
      this.calculateTimeWindow();
      this.lastThrottleTime = this.getCurrentTimeInSeconds();
      calculatedRate = this.cubicThrottle(rateToUse);
      this.enableTokenBucket();
    } else {
      this.calculateTimeWindow();
      calculatedRate = this.cubicSuccess(this.getCurrentTimeInSeconds());
    }

    const newRate = Math.min(calculatedRate, 2 * this.measuredTxRate);
    this.updateTokenBucketRate(newRate);
  }

  private getCurrentTimeInSeconds() {
    return Date.now() / 1000;
  }

  private async acquireTokenBucket(amount: number) {
    // Client side throttling is not enabled until we see a throttling error.
    if (!this.enabled) {
      return;
    }

    this.refillTokenBucket();

    while (amount > this.availableTokens) {
      const delay = ((amount - this.availableTokens) / this.fillRate) * 1000;
      await new Promise((resolve) => DefaultRateLimiter.setTimeoutFn(resolve, delay));
      this.refillTokenBucket();
    }
    this.availableTokens = this.availableTokens - amount;
  }

  private refillTokenBucket() {
    const timestamp = this.getCurrentTimeInSeconds();
    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
      return;
    }

    const fillAmount = (timestamp - this.lastTimestamp) * this.fillRate;
    this.availableTokens = Math.min(this.maxCapacity, this.availableTokens + fillAmount);
    this.lastTimestamp = timestamp;
  }

  private calculateTimeWindow() {
    this.timeWindow = this.getPrecise(Math.pow((this.lastMaxRate * (1 - this.beta)) / this.scaleConstant, 1 / 3));
  }

  /**
   * Returns a new fill rate in adaptive-tokens per second by reducing
   * the given rate by a factor of {@link beta}.
   */
  private cubicThrottle(rateToUse: number) {
    return this.getPrecise(rateToUse * this.beta);
  }

  /**
   * Returns a new fill rate in adaptive-tokens per second using a CUBIC
   * congestion control curve. The rate recovers toward {@link lastMaxRate},
   * then continues growing beyond it. The caller caps the result at
   * `2 * measuredTxRate`.
   */
  private cubicSuccess(timestamp: number) {
    return this.getPrecise(
      this.scaleConstant * Math.pow(timestamp - this.lastThrottleTime - this.timeWindow, 3) + this.lastMaxRate
    );
  }

  private enableTokenBucket() {
    this.enabled = true;
  }

  /**
   * Set a new fill rate for adaptive-tokens.
   * The max capacity is updated to allow for one second of time to approximately
   * refill the adaptive-token capacity.
   */
  private updateTokenBucketRate(newRate: number) {
    // Refill based on our current rate before we update to the new fill rate.
    this.refillTokenBucket();

    this.fillRate = Math.max(newRate, this.minFillRate);
    this.maxCapacity = Math.max(newRate, this.minCapacity);

    // When we scale down we can't have a current capacity that exceeds our maxCapacity.
    this.availableTokens = Math.min(this.availableTokens, this.maxCapacity);
  }

  private updateMeasuredRate() {
    const t = this.getCurrentTimeInSeconds();
    const timeBucket = Math.floor(t * 2) / 2;
    this.requestCount++;

    if (timeBucket > this.lastTxRateBucket) {
      const currentRate = this.requestCount / (timeBucket - this.lastTxRateBucket);
      this.measuredTxRate = this.getPrecise(currentRate * this.smooth + this.measuredTxRate * (1 - this.smooth));
      this.requestCount = 0;
      this.lastTxRateBucket = timeBucket;
    }
  }

  private getPrecise(num: number) {
    return parseFloat(num.toFixed(8));
  }
}
