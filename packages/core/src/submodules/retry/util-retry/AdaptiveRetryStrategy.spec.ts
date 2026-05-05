import type { RetryErrorInfo, StandardRetryToken } from "@smithy/types";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { AdaptiveRetryStrategy } from "./AdaptiveRetryStrategy";
import { DefaultRateLimiter } from "./DefaultRateLimiter";
import { StandardRetryStrategy } from "./StandardRetryStrategy";
import { RETRY_MODES } from "./config";
import type { RateLimiter } from "./types";

vi.mock("./StandardRetryStrategy");
vi.mock("./DefaultRateLimiter");

describe(AdaptiveRetryStrategy.name, () => {
  const maxAttemptsProvider = vi.fn();
  const retryTokenScope = "scope";
  const mockDefaultRateLimiter = {
    getSendToken: vi.fn(),
    updateClientSendingRate: vi.fn(),
  } as any;
  const mockRetryToken: StandardRetryToken = {
    getRetryCost: () => 1,
    getRetryCount: () => 1,
    getRetryDelay: () => 1,
  };
  const errorInfo = {
    errorType: "TRANSIENT",
  } as RetryErrorInfo;

  beforeEach(() => {
    vi.mocked(DefaultRateLimiter).mockReturnValue(mockDefaultRateLimiter);
  });

  afterEach(() => {
    vi.clearAllMocks();
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

    it("sets DefaultRateLimiter if options.rateLimiter undefined", () => {
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

  describe("acquireInitialRetryToken", () => {
    it("calls rateLimiter.getSendToken and returns initial retry token ", async () => {
      const mockedStandardRetryStrategy = vi.spyOn(StandardRetryStrategy.prototype, "acquireInitialRetryToken");
      mockedStandardRetryStrategy.mockResolvedValue(mockRetryToken);
      const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider, {
        rateLimiter: mockDefaultRateLimiter,
      });
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      expect(mockDefaultRateLimiter.getSendToken).toHaveBeenCalledTimes(1);
      expect(mockedStandardRetryStrategy).toHaveBeenCalledTimes(1);
      expect(token).toStrictEqual(mockRetryToken);
    });

    it("resolves the token before calling getSendToken", async () => {
      const mockedStandardRetryStrategy = vi.spyOn(StandardRetryStrategy.prototype, "acquireInitialRetryToken");
      let tokenResolved = false;
      mockedStandardRetryStrategy.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              tokenResolved = true;
              resolve(mockRetryToken);
            }, 10)
          )
      );
      mockDefaultRateLimiter.getSendToken.mockImplementation(() => {
        expect(tokenResolved).toBe(true);
        return Promise.resolve();
      });
      const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider, {
        rateLimiter: mockDefaultRateLimiter,
      });
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      expect(token).toStrictEqual(mockRetryToken);
    });
  });

  describe("refreshRetryTokenForRetry", () => {
    it("calls getSendToken, updateClientSendingRate, and refreshes retry token", async () => {
      const mockedStandardRetryStrategy = vi.spyOn(StandardRetryStrategy.prototype, "refreshRetryTokenForRetry");
      mockedStandardRetryStrategy.mockResolvedValue(mockRetryToken);
      const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider, {
        rateLimiter: mockDefaultRateLimiter,
      });
      const token = await retryStrategy.refreshRetryTokenForRetry(mockRetryToken, errorInfo);
      expect(mockDefaultRateLimiter.getSendToken).toHaveBeenCalledTimes(1);
      expect(mockDefaultRateLimiter.updateClientSendingRate).toHaveBeenCalledTimes(1);
      expect(mockDefaultRateLimiter.updateClientSendingRate).toHaveBeenCalledWith(errorInfo);
      expect(mockedStandardRetryStrategy).toHaveBeenCalledTimes(1);
      expect(mockedStandardRetryStrategy).toHaveBeenCalledWith(mockRetryToken, errorInfo);
      expect(token).toStrictEqual(mockRetryToken);
    });

    it("resolves the token before calling getSendToken", async () => {
      let tokenResolved = false;
      vi.spyOn(StandardRetryStrategy.prototype, "refreshRetryTokenForRetry").mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              tokenResolved = true;
              resolve(mockRetryToken);
            }, 10)
          )
      );
      mockDefaultRateLimiter.getSendToken.mockImplementation(() => {
        expect(tokenResolved).toBe(true);
        return Promise.resolve();
      });
      const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider, {
        rateLimiter: mockDefaultRateLimiter,
      });
      const token = await retryStrategy.refreshRetryTokenForRetry(mockRetryToken, errorInfo);
      expect(token).toStrictEqual(mockRetryToken);
    });

    it("calls updateClientSendingRate before getSendToken", async () => {
      const callOrder: string[] = [];
      mockDefaultRateLimiter.getSendToken.mockImplementation(() => {
        callOrder.push("getSendToken");
        return Promise.resolve();
      });
      mockDefaultRateLimiter.updateClientSendingRate.mockImplementation(() => {
        callOrder.push("updateClientSendingRate");
      });
      vi.spyOn(StandardRetryStrategy.prototype, "refreshRetryTokenForRetry").mockResolvedValue(mockRetryToken);

      const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider, {
        rateLimiter: mockDefaultRateLimiter,
      });
      await retryStrategy.refreshRetryTokenForRetry(mockRetryToken, errorInfo);
      expect(callOrder).toEqual(["updateClientSendingRate", "getSendToken"]);
    });

    it("calls getSendToken for each retry in a multi-retry sequence", async () => {
      vi.spyOn(StandardRetryStrategy.prototype, "refreshRetryTokenForRetry").mockResolvedValue(mockRetryToken);
      const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider, {
        rateLimiter: mockDefaultRateLimiter,
      });

      await retryStrategy.refreshRetryTokenForRetry(mockRetryToken, errorInfo);
      await retryStrategy.refreshRetryTokenForRetry(mockRetryToken, errorInfo);
      await retryStrategy.refreshRetryTokenForRetry(mockRetryToken, errorInfo);

      expect(mockDefaultRateLimiter.getSendToken).toHaveBeenCalledTimes(3);
      expect(mockDefaultRateLimiter.updateClientSendingRate).toHaveBeenCalledTimes(3);
    });
  });

  describe("recordSuccess", () => {
    it("rateLimiter.updateCientSendingRate and records success on token", async () => {
      const mockedStandardRetryStrategy = vi.spyOn(StandardRetryStrategy.prototype, "recordSuccess");
      const retryStrategy = new AdaptiveRetryStrategy(maxAttemptsProvider, {
        rateLimiter: mockDefaultRateLimiter,
      });
      retryStrategy.recordSuccess(mockRetryToken);
      expect(mockDefaultRateLimiter.updateClientSendingRate).toHaveBeenCalledTimes(1);
      expect(mockDefaultRateLimiter.updateClientSendingRate).toHaveBeenCalledWith({});
      expect(mockedStandardRetryStrategy).toHaveBeenCalledTimes(1);
      expect(mockedStandardRetryStrategy).toHaveBeenCalledWith(mockRetryToken);
    });
  });
});
