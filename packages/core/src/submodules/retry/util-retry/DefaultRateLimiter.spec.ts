import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { isThrottlingError } from "../service-error-classification/service-error-classification";
import { DefaultRateLimiter } from "./DefaultRateLimiter";

vi.mock("../service-error-classification/service-error-classification");

describe(DefaultRateLimiter.name, () => {
  beforeEach(() => {
    vi.mocked(isThrottlingError).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getSendToken", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      [0.5, 892.8571428571428],
      [1, 1785.7142857142856],
      [2, 2000],
    ])("timestamp: %d, delay: %d", async (timestamp, delay) => {
      const spy = vi.spyOn(DefaultRateLimiter as any, "setTimeoutFn");
      vi.spyOn(Date, "now").mockImplementation(() => 0);
      const rateLimiter = new DefaultRateLimiter();

      vi.mocked(isThrottlingError).mockReturnValueOnce(true);
      vi.spyOn(Date, "now").mockImplementation(() => timestamp * 1000);
      rateLimiter.updateClientSendingRate({});

      rateLimiter.getSendToken();
      vi.runAllTimers();
      expect(spy).toHaveBeenLastCalledWith(expect.any(Function), delay);
    });
  });

  describe("cubicSuccess", () => {
    it.each([
      [5, 7],
      [6, 9.64893601],
      [7, 10.00003085],
      [8, 10.45328452],
      [9, 13.40869703],
      [10, 21.26626836],
      [11, 36.42599853],
    ])("timestamp: %d, calculatedRate: %d", (timestamp, calculatedRate) => {
      vi.spyOn(Date, "now").mockImplementation(() => 0);
      const rateLimiter = new DefaultRateLimiter();
      rateLimiter["lastMaxRate"] = 10;
      rateLimiter["lastThrottleTime"] = 5;

      vi.spyOn(Date, "now").mockImplementation(() => timestamp * 1000);

      const cubicSuccessSpy = vi.spyOn(DefaultRateLimiter.prototype as any, "cubicSuccess");
      rateLimiter.updateClientSendingRate({});
      expect(cubicSuccessSpy).toHaveLastReturnedWith(calculatedRate);
    });
  });

  describe("cubicThrottle", () => {
    it.each([
      [5, 0.112],
      [6, 0.09333333],
      [7, 0.08],
      [8, 0.07],
      [9, 0.06222222],
    ])("timestamp: %d, calculatedRate: %d", (timestamp, calculatedRate) => {
      vi.spyOn(Date, "now").mockImplementation(() => 0);
      const rateLimiter = new DefaultRateLimiter();
      rateLimiter["lastMaxRate"] = 10;
      rateLimiter["lastThrottleTime"] = 5;

      vi.mocked(isThrottlingError).mockReturnValueOnce(true);
      vi.spyOn(Date, "now").mockImplementation(() => timestamp * 1000);
      const cubicThrottleSpy = vi.spyOn(DefaultRateLimiter.prototype as any, "cubicThrottle");
      rateLimiter.updateClientSendingRate({});
      expect(cubicThrottleSpy).toHaveLastReturnedWith(calculatedRate);
    });
  });

  it("detects throttling from an error with status code 429 or $retryable.throttling", async () => {
    const { isThrottlingError: realIsThrottlingError } = await vi.importActual<any>(
      "@smithy/service-error-classification"
    );

    vi.spyOn(Date, "now").mockImplementation(() => 0);

    for (const error of [
      { name: "ThrottlingStatusCodeException", $metadata: { httpStatusCode: 429 } },
      { name: "ThrottlingModelMetadataException", $retryable: { throttling: true } },
    ]) {
      const rateLimiter = new DefaultRateLimiter();
      vi.mocked(isThrottlingError).mockImplementation(realIsThrottlingError);
      vi.spyOn(Date, "now").mockImplementation(() => 1000);
      rateLimiter.updateClientSendingRate({ errorType: "TRANSIENT", error } as any);
      expect(rateLimiter["enabled"]).toBe(true);
    }
  });

  it("treats a RetryErrorInfo with errorType THROTTLING as a throttling error", () => {
    vi.spyOn(Date, "now").mockImplementation(() => 0);
    const rateLimiter = new DefaultRateLimiter();

    vi.spyOn(Date, "now").mockImplementation(() => 1000);
    rateLimiter.updateClientSendingRate({ errorType: "THROTTLING" });

    expect(rateLimiter["enabled"]).toBe(true);
    expect(isThrottlingError).not.toHaveBeenCalled();
  });

  describe("acquireTokenBucket re-checks after sleep", () => {
    it("availableTokens is never negative after acquire", async () => {
      vi.spyOn(Date, "now").mockImplementation(() => 0);
      const rateLimiter = new DefaultRateLimiter();

      // Enable the rate limiter with a throttle.
      vi.mocked(isThrottlingError).mockReturnValueOnce(true);
      vi.spyOn(Date, "now").mockImplementation(() => 1000);
      rateLimiter.updateClientSendingRate({});

      // Drain tokens to force a sleep path.
      rateLimiter["availableTokens"] = 0.1;
      rateLimiter["fillRate"] = 10;
      rateLimiter["lastTimestamp"] = 1;

      // Time advances during the sleep so refill provides tokens.
      let now = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      const spy = vi.spyOn(DefaultRateLimiter as any, "setTimeoutFn");
      spy.mockImplementation((resolve: any) => {
        now += 200; // 200ms passes during sleep
        resolve();
      });

      await rateLimiter.getSendToken();
      expect(rateLimiter["availableTokens"]).toBeGreaterThanOrEqual(0);
    });

    it("loops when fill rate decreases during sleep", async () => {
      vi.spyOn(Date, "now").mockImplementation(() => 0);
      const rateLimiter = new DefaultRateLimiter();

      // Enable the rate limiter.
      vi.mocked(isThrottlingError).mockReturnValueOnce(true);
      vi.spyOn(Date, "now").mockImplementation(() => 1000);
      rateLimiter.updateClientSendingRate({});

      rateLimiter["availableTokens"] = 0;
      rateLimiter["fillRate"] = 10;
      rateLimiter["maxCapacity"] = 10;
      rateLimiter["lastTimestamp"] = 1;

      let now = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => now);

      let callCount = 0;
      const spy = vi.spyOn(DefaultRateLimiter as any, "setTimeoutFn");
      spy.mockImplementation((resolve: any) => {
        callCount++;
        now += 50; // 50ms passes
        if (callCount === 1) {
          // Simulate rate dropping mid-sleep (e.g. concurrent throttle response).
          rateLimiter["fillRate"] = 0.5;
          rateLimiter["maxCapacity"] = 1;
        }
        resolve();
      });

      await rateLimiter.getSendToken();

      // Should have looped more than once because the first sleep
      // didn't provide enough tokens after the rate drop.
      expect(callCount).toBeGreaterThan(1);
      expect(rateLimiter["availableTokens"]).toBeGreaterThanOrEqual(0);
    });

    it("refills token bucket after each sleep iteration", async () => {
      vi.spyOn(Date, "now").mockImplementation(() => 0);
      const rateLimiter = new DefaultRateLimiter();

      // Enable the rate limiter.
      vi.mocked(isThrottlingError).mockReturnValueOnce(true);
      vi.spyOn(Date, "now").mockImplementation(() => 1000);
      rateLimiter.updateClientSendingRate({});

      rateLimiter["availableTokens"] = 0;
      rateLimiter["fillRate"] = 2;
      rateLimiter["maxCapacity"] = 2;
      rateLimiter["lastTimestamp"] = 1;

      let now = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => now);

      const refillSpy = vi.spyOn(rateLimiter as any, "refillTokenBucket");
      const spy = vi.spyOn(DefaultRateLimiter as any, "setTimeoutFn");
      spy.mockImplementation((resolve: any) => {
        now += 600; // enough time for refill to provide tokens
        resolve();
      });

      await rateLimiter.getSendToken();

      // refillTokenBucket called: once before the loop + once inside the loop
      expect(refillSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("updateClientSendingRate", () => {
    vi.spyOn(Date, "now").mockImplementation(() => 0);
    const rateLimiter = new DefaultRateLimiter();

    const testCases: [boolean, number, number, number][] = [
      [false, 0.2, 0, 0.5],
      [false, 0.4, 0, 0.5],
      [false, 0.6, 4.8, 0.5],
      [false, 0.8, 4.8, 0.5],
      [false, 1, 4.16, 0.5],
      [false, 1.2, 4.16, 0.6912],
      [false, 1.4, 4.16, 1.0976],
      [false, 1.6, 5.632, 1.6384],
      [false, 1.8, 5.632, 2.3328],
      [true, 2, 4.3264, 3.02848],
      [false, 2.2, 4.3264, 3.486639],
      [false, 2.4, 4.3264, 3.821874],
      [false, 2.6, 5.66528, 4.053386],
      [false, 2.8, 5.66528, 4.200373],
      [false, 3.0, 4.333056, 4.282037],
      [true, 3.2, 4.333056, 2.997426],
      [false, 3.4, 4.333056, 3.452226],
    ];

    testCases.forEach(([isThrottlingErrorReturn, timestamp, measuredTxRate, fillRate]) => {
      vi.mocked(isThrottlingError).mockReturnValue(isThrottlingErrorReturn);
      vi.spyOn(Date, "now").mockImplementation(() => timestamp * 1000);

      rateLimiter.updateClientSendingRate({});
      expect(rateLimiter["measuredTxRate"]).toEqual(measuredTxRate);
      expect(parseFloat(rateLimiter["fillRate"].toFixed(6))).toEqual(fillRate);
    });
  });
});
