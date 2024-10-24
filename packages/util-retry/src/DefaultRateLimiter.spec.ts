import { isThrottlingError } from "@smithy/service-error-classification";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { DefaultRateLimiter } from "./DefaultRateLimiter";

vi.mock("@smithy/service-error-classification");

describe(DefaultRateLimiter.name, () => {
  beforeEach(() => {
    vi.mocked(isThrottlingError).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getSendToken", () => {
    beforeEach(() => {
      vi.useFakeTimers({ legacyFakeTimers: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      [0.5, 892.8571428571428],
      [1, 1785.7142857142856],
      [2, 2000],
    ])("timestamp: %d, delay: %d", async (timestamp, delay) => {
      vi.spyOn(Date, "now").mockImplementation(() => 0);
      const rateLimiter = new DefaultRateLimiter();

      vi.mocked(isThrottlingError).mockReturnValueOnce(true);
      vi.spyOn(Date, "now").mockImplementation(() => timestamp * 1000);
      rateLimiter.updateClientSendingRate({});

      rateLimiter.getSendToken();
      vi.runAllTimers();
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), delay);
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
