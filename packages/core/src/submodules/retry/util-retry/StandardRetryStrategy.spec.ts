import type { RetryErrorInfo } from "@smithy/types";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { RETRY_MODES } from "./config";
import { MAXIMUM_RETRY_DELAY } from "./constants";
import { DefaultRetryBackoffStrategy } from "./DefaultRetryBackoffStrategy";
import { DefaultRetryToken } from "./DefaultRetryToken";
import { Retry } from "./retries-2026-config";
import { StandardRetryStrategy } from "./StandardRetryStrategy";

class DeterministicRetryBackoffStrategy extends DefaultRetryBackoffStrategy {
  public computeNextBackoffDelay(i: number): number {
    const b = 1; // maximum instead of Math.random()
    const r = 2;
    const t_i = b * Math.min(this.x * r ** i, MAXIMUM_RETRY_DELAY);
    return Math.floor(t_i);
  }
}

vi.mock("./DefaultRetryToken");

describe(StandardRetryStrategy.name, () => {
  const maxAttempts = 3;
  const retryTokenScope = "scope";
  const noRetryTokenAvailableError = new Error("No retry token available");
  const errorInfo = { errorType: "TRANSIENT" } as RetryErrorInfo;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sets maxAttemptsProvider as a class member variable", async () => {
    for (const maxAttempts of [1, 2, 3]) {
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
      await expect(retryStrategy["maxAttemptsProvider"]()).resolves.toBe(maxAttempts);
    }
  });

  it(`sets mode=${RETRY_MODES.STANDARD}`, () => {
    const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
    expect(retryStrategy.mode).toStrictEqual(RETRY_MODES.STANDARD);
  });

  describe("acquireInitialRetryToken", () => {
    it("returns default retryToken", async () => {
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
      const retryToken = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      const defaultToken = new DefaultRetryToken(Retry.delay(), 0, 0, false);
      expect([retryToken.getRetryCost(), retryToken.getRetryCount(), retryToken.getRetryDelay()]).toEqual([
        defaultToken.getRetryCost(),
        defaultToken.getRetryCount(),
        defaultToken.getRetryDelay(),
      ]);
    });
  });

  describe("refreshRetryTokenForRetry", () => {
    it("refreshes the token", async () => {
      const getRetryCount = vi.fn().mockReturnValue(0);
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      await retryStrategy.refreshRetryTokenForRetry(token, errorInfo);
      expect(getRetryCount).toHaveBeenCalledTimes(3);
    });

    it("disables any retries when maxAttempts is 1", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 0,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(1);
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      try {
        await retryStrategy.refreshRetryTokenForRetry(token, errorInfo);
        fail(`expected ${noRetryTokenAvailableError}`);
      } catch (error) {
        expect(error).toStrictEqual(noRetryTokenAvailableError);
      }
    });

    it("throws when attempts exceeds maxAttempts", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 2,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(1));
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      try {
        await retryStrategy.refreshRetryTokenForRetry(token, errorInfo);
        fail(`expected ${noRetryTokenAvailableError}`);
      } catch (error) {
        expect(error).toStrictEqual(noRetryTokenAvailableError);
      }
    });

    it("throws when attempts exceeds default max attempts (3)", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 5,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(5));
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      try {
        await retryStrategy.refreshRetryTokenForRetry(token, errorInfo);
        fail(`expected ${noRetryTokenAvailableError}`);
      } catch (error) {
        expect(error).toStrictEqual(noRetryTokenAvailableError);
      }
    });

    it("throws when error is non-retryable", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 0,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      const errorInfo = {
        errorType: "CLIENT_ERROR",
      } as RetryErrorInfo;
      try {
        await retryStrategy.refreshRetryTokenForRetry(token, errorInfo);
        fail(`expected ${noRetryTokenAvailableError}`);
      } catch (error) {
        expect(error).toStrictEqual(noRetryTokenAvailableError);
      }
    });
  });

  describe("retryCode", () => {
    it("returns code 1 (non-retryable) with highest priority over other reasons", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 5,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(1);
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      // non-retryable + attempts exhausted: should get code 1 (non-retryable wins)
      const result = retryStrategy["retryCode"](token, { errorType: "CLIENT_ERROR" } as RetryErrorInfo, 1);
      expect(result).toBe(1);
    });

    it("returns code 2 (attempts exhausted) when retryable but no attempts left", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 2,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(maxAttempts);
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      const result = retryStrategy["retryCode"](token, errorInfo, maxAttempts);
      expect(result).toBe(2);
    });

    it("returns code 3 (no capacity) when retryable with attempts left but no tokens", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 0,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(maxAttempts);
      retryStrategy["capacity"] = 0;
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      const result = retryStrategy["retryCode"](token, errorInfo, maxAttempts);
      expect(result).toBe(3);
    });

    it("returns code 0 (OK to retry) when all conditions are met", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 0,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(maxAttempts);
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      const result = retryStrategy["retryCode"](token, errorInfo, maxAttempts);
      expect(result).toBe(0);
    });
  });

  describe("long-poll token behavior", () => {
    it("throws with $backoff when long-poll token has no capacity (code 3)", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 0,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
            isLongPoll: () => true,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(maxAttempts);
      retryStrategy["capacity"] = 0;
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      try {
        await retryStrategy.refreshRetryTokenForRetry(token, errorInfo);
        fail("expected error");
      } catch (error: any) {
        expect(error.message).toBe("No retry token available");
        // $backoff is 0 when Retry.v2026 is false, non-zero when true
        expect(error.$backoff).toBe(0);
      }
    });

    it("throws with $backoff=0 when long-poll token fails for non-capacity reason (code 1)", async () => {
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount: () => 0,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
            isLongPoll: () => true,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(maxAttempts);
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      try {
        await retryStrategy.refreshRetryTokenForRetry(token, { errorType: "CLIENT_ERROR" } as RetryErrorInfo);
        fail("expected error");
      } catch (error: any) {
        expect(error.message).toBe("No retry token available");
        expect(error.$backoff).toBe(0);
      }
    });

    it("retries long-poll token even when retryCode is non-zero, if capacity exists", async () => {
      const getRetryCount = vi.fn().mockReturnValue(0);
      vi.mocked(DefaultRetryToken).mockImplementation(
        () =>
          ({
            getRetryCount,
            getRetryCost: () => 0,
            getRetryDelay: () => 0,
            isLongPoll: () => true,
          }) as any
      );
      const retryStrategy = new StandardRetryStrategy(maxAttempts);
      const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
      const refreshed = await retryStrategy.refreshRetryTokenForRetry(token, errorInfo);
      expect(refreshed).toBeDefined();
    });

    describe("with Retry.v2026 enabled", () => {
      let originalV2026: boolean;

      beforeEach(() => {
        originalV2026 = Retry.v2026;
        Retry.v2026 = true;
      });

      afterEach(() => {
        Retry.v2026 = originalV2026;
      });

      it("throws with non-zero $backoff for code 3", async () => {
        vi.mocked(DefaultRetryToken).mockImplementation(
          () =>
            ({
              getRetryCount: () => 0,
              getRetryCost: () => 0,
              getRetryDelay: () => 0,
              isLongPoll: () => true,
            }) as any
        );
        const retryStrategy = new StandardRetryStrategy({
          maxAttempts,
          backoff: new DeterministicRetryBackoffStrategy(),
        });
        retryStrategy["capacity"] = 0;
        const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
        await expect(retryStrategy.refreshRetryTokenForRetry(token, errorInfo)).rejects.toMatchObject({
          message: "No retry token available",
          $backoff: 50, // b=1 * min(50 * 2^0, 20000) = 50
        });
      });

      it("throws with $backoff=0 for non-capacity code", async () => {
        vi.mocked(DefaultRetryToken).mockImplementation(
          () =>
            ({
              getRetryCount: () => 0,
              getRetryCost: () => 0,
              getRetryDelay: () => 0,
              isLongPoll: () => true,
            }) as any
        );
        const retryStrategy = new StandardRetryStrategy(maxAttempts);
        const token = await retryStrategy.acquireInitialRetryToken(retryTokenScope);
        await expect(
          retryStrategy.refreshRetryTokenForRetry(token, { errorType: "CLIENT_ERROR" } as RetryErrorInfo)
        ).rejects.toMatchObject({
          message: "No retry token available",
          $backoff: 0,
        });
      });
    });
  });
});
