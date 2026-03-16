import type { RetryErrorInfo } from "@smithy/types";
import { afterEach, describe, expect, test as it, vi } from "vitest";

import { RETRY_MODES } from "./config";
import { DefaultRetryToken } from "./DefaultRetryToken";
import { Retry } from "./retries-2026-config";
import { StandardRetryStrategy } from "./StandardRetryStrategy";

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
});
