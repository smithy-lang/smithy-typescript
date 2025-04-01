import { DefaultRateLimiter, RateLimiter, RETRY_MODES } from "@smithy/util-retry";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { AdaptiveRetryStrategy } from "./AdaptiveRetryStrategy";
import { StandardRetryStrategy } from "./StandardRetryStrategy";
import { RetryQuota } from "./types";

vi.mock("./StandardRetryStrategy");
vi.mock("@smithy/util-retry");

describe(AdaptiveRetryStrategy.name, () => {
  const maxAttemptsProvider = vi.fn();
  const mockDefaultRateLimiter = {
    getSendToken: vi.fn(),
    updateClientSendingRate: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(DefaultRateLimiter).mockReturnValue(mockDefaultRateLimiter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("calls super constructor", () => {
      const retryDecider = vi.fn();
      const delayDecider = vi.fn();
      const retryQuota = {} as RetryQuota;
      const rateLimiter = {} as RateLimiter;

      new AdaptiveRetryStrategy(maxAttemptsProvider, {
        retryDecider,
        delayDecider,
        retryQuota,
        rateLimiter,
      });
      expect(StandardRetryStrategy).toHaveBeenCalledWith(maxAttemptsProvider, {
        retryDecider,
        delayDecider,
        retryQuota,
      });
    });

    it(`sets mode=${RETRY_MODES.ADAPTIVE}`, () => {
      const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider);
      expect(retryStrategy.mode).toStrictEqual(RETRY_MODES.ADAPTIVE);
    });

    describe("rateLimiter init", () => {
      it("sets getDefaultrateLimiter if options is undefined", () => {
        const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider);
        expect(retryStrategy["rateLimiter"]).toBe(mockDefaultRateLimiter);
      });

      it("sets getDefaultrateLimiter if options.delayDecider undefined", () => {
        const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider, {});
        expect(retryStrategy["rateLimiter"]).toBe(mockDefaultRateLimiter);
      });

      it("sets options.rateLimiter if defined", () => {
        const rateLimiter = {} as RateLimiter;
        const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider, {
          rateLimiter,
        });
        expect(retryStrategy["rateLimiter"]).toBe(rateLimiter);
      });
    });
  });

  describe("retry", () => {
    const mockedSuperRetry = vi.spyOn(StandardRetryStrategy.prototype, "retry");

    beforeEach(async () => {
      const next = vi.fn();
      const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider);
      await retryStrategy.retry(next, { request: { headers: {} } } as any);
      expect(mockedSuperRetry).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("calls rateLimiter.getSendToken in beforeRequest", async () => {
      expect(mockDefaultRateLimiter.getSendToken).toHaveBeenCalledTimes(0);
      await mockedSuperRetry.mock.calls[0][2].beforeRequest();
      expect(mockDefaultRateLimiter.getSendToken).toHaveBeenCalledTimes(1);
    });

    it("calls rateLimiter.updateClientSendingRate in afterRequest", async () => {
      expect(mockDefaultRateLimiter.updateClientSendingRate).toHaveBeenCalledTimes(0);
      await mockedSuperRetry.mock.calls[0][2].afterRequest();
      expect(mockDefaultRateLimiter.updateClientSendingRate).toHaveBeenCalledTimes(1);
    });
  });
});
