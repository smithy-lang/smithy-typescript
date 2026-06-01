import { describe, expect, test as it, vi } from "vitest";

import { ConfiguredRetryStrategy } from "./ConfiguredRetryStrategy";

describe(ConfiguredRetryStrategy.name, () => {
  it("allows setting a custom backoff function", async () => {
    vi.useFakeTimers();
    const strategy = new ConfiguredRetryStrategy(5, (attempt) => attempt * 1000);

    let token = await strategy.acquireInitialRetryToken("");

    let retryTokenPromise = strategy.refreshRetryTokenForRetry(token, { errorType: "TRANSIENT" });
    await vi.advanceTimersByTimeAsync(1000);
    token = await retryTokenPromise;
    expect(token.$retryLog?.acquisitionDelay).toBe(1000);

    retryTokenPromise = strategy.refreshRetryTokenForRetry(token, { errorType: "TRANSIENT" });
    await vi.advanceTimersByTimeAsync(2000);
    token = await retryTokenPromise;
    expect(token.$retryLog?.acquisitionDelay).toBe(2000);

    retryTokenPromise = strategy.refreshRetryTokenForRetry(token, { errorType: "TRANSIENT" });
    await vi.advanceTimersByTimeAsync(3000);
    token = await retryTokenPromise;
    expect(token.$retryLog?.acquisitionDelay).toBe(3000);

    vi.useRealTimers();
  });
});
