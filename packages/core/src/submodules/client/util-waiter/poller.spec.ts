import { AbortController as AbortControllerPolyfill } from "@smithy/abort-controller";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { runPolling } from "./poller";
import { sleep } from "./utils/sleep";
import { WaiterState, type WaiterOptions } from "./waiter";

vi.mock("./utils/sleep");

describe(runPolling.name, () => {
  const config = {
    minDelay: 2,
    maxDelay: 30,
    maxWaitTime: 99999,
    client: "mockClient",
  } as WaiterOptions<any>;
  const input = "mockInput";
  const abortedState = {
    state: WaiterState.ABORTED,
    observedResponses: {
      "AbortController signal aborted.": 1,
    },
  };
  const failureState = {
    state: WaiterState.FAILURE,
    reason: {
      mockedReason: "some-failure-value",
    },
    final: {
      mockedReason: "some-failure-value",
    },
    observedResponses: {
      [JSON.stringify({
        mockedReason: "some-failure-value",
      })]: 1,
    },
  };
  const successState = {
    state: WaiterState.SUCCESS,
    reason: {
      mockedReason: "some-success-value",
    },
    final: {
      mockedReason: "some-success-value",
    },
    observedResponses: {
      [JSON.stringify({
        mockedReason: "some-success-value",
      })]: 1,
    },
  };
  const retryState = {
    state: WaiterState.RETRY,
    reason: undefined,
    observedResponses: {},
  };
  const timeoutState = {
    state: WaiterState.TIMEOUT,
    observedResponses: {},
  };

  let mockAcceptorChecks;

  beforeEach(() => {
    vi.mocked(sleep).mockResolvedValueOnce("");
    vi.spyOn(global.Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global.Math, "random").mockRestore();
  });

  it("should returns state and reason in case of failure", async () => {
    mockAcceptorChecks = vi.fn().mockResolvedValueOnce(failureState);
    await expect(runPolling(config, input, mockAcceptorChecks)).resolves.toStrictEqual(failureState);

    expect(mockAcceptorChecks).toHaveBeenCalled();
    expect(mockAcceptorChecks).toHaveBeenCalledTimes(1);
    expect(mockAcceptorChecks).toHaveBeenCalledWith(config.client, input);
    expect(sleep).toHaveBeenCalledTimes(0);
  });

  it("returns state and reason in case of success", async () => {
    mockAcceptorChecks = vi.fn().mockResolvedValueOnce(successState);
    await expect(runPolling(config, input, mockAcceptorChecks)).resolves.toStrictEqual(successState);
    expect(mockAcceptorChecks).toHaveBeenCalled();
    expect(mockAcceptorChecks).toHaveBeenCalledTimes(1);
    expect(mockAcceptorChecks).toHaveBeenCalledWith(config.client, input);
    expect(sleep).toHaveBeenCalledTimes(0);
  });

  it("sleeps as per exponentialBackoff in case of retry", async () => {
    mockAcceptorChecks = vi
      .fn()
      .mockResolvedValueOnce(retryState)
      .mockResolvedValueOnce(retryState)
      .mockResolvedValueOnce(retryState)
      .mockResolvedValueOnce(retryState)
      .mockResolvedValueOnce(retryState)
      .mockResolvedValueOnce(retryState)
      .mockResolvedValueOnce(retryState)
      .mockResolvedValueOnce(successState);

    await expect(runPolling(config, input, mockAcceptorChecks)).resolves.toStrictEqual(successState);

    expect(sleep).toHaveBeenCalled();
    expect(mockAcceptorChecks).toHaveBeenCalledTimes(8);
    expect(sleep).toHaveBeenCalledTimes(7);
    expect(sleep).toHaveBeenNthCalledWith(1, 2); // min delay
    expect(sleep).toHaveBeenNthCalledWith(2, 3); // random(2, 4)
    expect(sleep).toHaveBeenNthCalledWith(3, 5); // random(2, 8)
    expect(sleep).toHaveBeenNthCalledWith(4, 9); // random(2, 16)
    expect(sleep).toHaveBeenNthCalledWith(5, 30); // past attemptCeiling, maxDelay
    expect(sleep).toHaveBeenNthCalledWith(6, 30); // past attemptCeiling
    expect(sleep).toHaveBeenNthCalledWith(7, 30); // past attemptCeiling
  });

  it("resolves after the last attempt before reaching maxWaitTime ", async () => {
    let now = Date.now();
    const delay = 2;
    const nowMock = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(now) // 1st invoke for getting the time stamp to wait until
      .mockImplementation(() => {
        const rtn = now;
        now += delay * 1000;
        return rtn;
      });
    const localConfig = {
      ...config,
      minDelay: delay,
      maxDelay: delay,
      maxWaitTime: 5,
    };

    mockAcceptorChecks = vi.fn().mockResolvedValue(retryState);
    await expect(runPolling(localConfig, input, mockAcceptorChecks)).resolves.toStrictEqual(timeoutState);
    nowMock.mockReset();
  });

  it.each([
    { label: "native", AbortController },
    { label: "smithy", AbortController: AbortControllerPolyfill },
  ])("resolves when abortController is signalled ($label)", async ({ AbortController }) => {
    const abortController = new AbortController();
    const localConfig = {
      ...config,
      abortController,
    };

    mockAcceptorChecks = vi.fn().mockResolvedValue(retryState);
    abortController.abort();
    await expect(runPolling(localConfig, input, mockAcceptorChecks)).resolves.toStrictEqual(abortedState);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("should populate 'final' alongside 'reason' on non-retry results", async () => {
    const reason = { code: "ResourceReady" };
    mockAcceptorChecks = vi.fn().mockResolvedValueOnce({ state: WaiterState.SUCCESS, reason });
    const result = await runPolling(config, input, mockAcceptorChecks);
    expect(result.final).toStrictEqual(reason);
    expect(result.reason).toStrictEqual(reason);
  });

  it("should populate 'final' after retries resolve to a terminal state", async () => {
    const reason = { code: "InstanceRunning" };
    mockAcceptorChecks = vi
      .fn()
      .mockResolvedValueOnce(retryState)
      .mockResolvedValueOnce({ state: WaiterState.SUCCESS, reason });
    const result = await runPolling(config, input, mockAcceptorChecks);
    expect(result.final).toStrictEqual(reason);
    expect(result.reason).toStrictEqual(reason);
  });

  it("should not populate 'final' on timeout", async () => {
    let now = Date.now();
    const delay = 2;
    const nowMock = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(now)
      .mockImplementation(() => {
        const rtn = now;
        now += delay * 1000;
        return rtn;
      });
    const localConfig = {
      ...config,
      minDelay: delay,
      maxDelay: delay,
      maxWaitTime: 5,
    };
    mockAcceptorChecks = vi.fn().mockResolvedValue(retryState);
    const result = await runPolling(localConfig, input, mockAcceptorChecks);
    expect(result.state).toBe(WaiterState.TIMEOUT);
    expect(result.final).toBeUndefined();
    nowMock.mockReset();
  });

  it("should warn when polling exceeds 60s and 403s are observed", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const reason403 = { $metadata: { httpStatusCode: 403 }, message: "Forbidden" };
    const retryWith403 = { state: WaiterState.RETRY, reason: reason403 };

    // Simulate time: start at T=0, each Date.now() call advances 20s.
    // This ensures we cross the 60s warn403Time threshold after a few polls.
    let now = 1_000_000;
    const nowMock = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(now) // waitUntil
      .mockImplementation(() => {
        const rtn = now;
        now += 20_000;
        return rtn;
      });

    const localConfig = {
      ...config,
      minDelay: 2,
      maxDelay: 2,
      maxWaitTime: 300,
      client: { config: {} },
    } as WaiterOptions<any>;

    mockAcceptorChecks = vi
      .fn()
      .mockResolvedValueOnce(retryWith403) // initial check
      .mockResolvedValueOnce(retryWith403) // poll 1
      .mockResolvedValueOnce(retryWith403) // poll 2
      .mockResolvedValueOnce(retryWith403) // poll 3
      .mockResolvedValueOnce({ state: WaiterState.SUCCESS, reason: { $metadata: { httpStatusCode: 200 } } });

    await runPolling(localConfig, input, mockAcceptorChecks);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("403 status code encountered during waiter polling"));

    warnSpy.mockRestore();
    nowMock.mockReset();
  });

  it("should truncate delay to fire a last poll before timeout", async () => {
    // Use real-ish time: start at T=0, advance 1s per Date.now() call.
    let now = 1_000_000;
    const nowMock = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(now) // waitUntil = now + 10_000
      .mockImplementation(() => {
        const rtn = now;
        now += 1_000;
        return rtn;
      });

    const localConfig = {
      ...config,
      minDelay: 2,
      maxDelay: 30,
      maxWaitTime: 10,
      client: "mockClient",
    } as WaiterOptions<any>;

    mockAcceptorChecks = vi
      .fn()
      .mockResolvedValueOnce(retryState) // initial check
      .mockResolvedValue({ state: WaiterState.SUCCESS, reason: { ok: true } });

    const result = await runPolling(localConfig, input, mockAcceptorChecks);

    // The backoff function should have truncated the delay so that
    // sleep was called with a value less than the normal backoff,
    // allowing one more poll before timeout.
    expect(sleep).toHaveBeenCalled();
    const sleepArg = vi.mocked(sleep).mock.calls[0][0];
    expect(sleepArg).toBeLessThanOrEqual(localConfig.maxDelay);
    expect(result.state).toBe(WaiterState.SUCCESS);

    nowMock.mockReset();
  });
});
