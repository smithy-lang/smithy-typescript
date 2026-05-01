import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { createWaiter } from "./createWaiter";
import type { WaiterOptions } from "./waiter";
import { WaiterState } from "./waiter";

vi.mock("./utils/validate", () => ({
  validateWaiterOptions: vi.fn(),
}));

describe("createWaiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const minimalWaiterConfig = {
    minDelay: 2,
    maxDelay: 120,
    maxWaitTime: 9999,
    client: "client",
  } as WaiterOptions<any>;
  const input = "input";

  const abortedState = {
    state: WaiterState.ABORTED,
  };
  const failureState = {
    state: WaiterState.FAILURE,
  };
  const retryState = {
    state: WaiterState.RETRY,
  };
  const successState = {
    state: WaiterState.SUCCESS,
  };

  it("should abort when abortController is signalled", async () => {
    const abortController = new AbortController();
    const mockAcceptorChecks = vi.fn().mockResolvedValue(retryState);
    const statusPromise = createWaiter(
      {
        ...minimalWaiterConfig,
        maxWaitTime: 20,
        abortController,
      },
      input,
      mockAcceptorChecks
    );
    vi.advanceTimersByTime(10 * 1000);
    abortController.abort(); // Abort before maxWaitTime(20s);
    expect(await statusPromise).toMatchObject(abortedState);
  });

  it("should remove the event listener on the abort signal after the waiter resolves regardless of whether it has been invoked", async () => {
    const abortController = new AbortController();
    vi.spyOn(abortController.signal, "addEventListener");
    vi.spyOn(abortController.signal, "removeEventListener");

    const mockAcceptorChecks = vi.fn().mockResolvedValue(successState);
    const statusPromise = createWaiter(
      {
        ...minimalWaiterConfig,
        abortSignal: abortController.signal,
        maxWaitTime: 20,
      },
      input,
      mockAcceptorChecks
    );
    expect(abortController.signal.addEventListener).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(minimalWaiterConfig.minDelay * 1000);
    expect(await statusPromise).toMatchObject(successState);
    expect(abortController.signal.removeEventListener).toHaveBeenCalledOnce();
  });

  it("should succeed when acceptor checker returns success", async () => {
    const mockAcceptorChecks = vi.fn().mockResolvedValue(successState);
    const statusPromise = createWaiter(
      {
        ...minimalWaiterConfig,
        maxWaitTime: 20,
      },
      input,
      mockAcceptorChecks
    );
    vi.advanceTimersByTime(minimalWaiterConfig.minDelay * 1000);
    expect(await statusPromise).toMatchObject(successState);
  });

  it("should fail when acceptor checker returns failure", async () => {
    const mockAcceptorChecks = vi.fn().mockResolvedValue(failureState);
    const statusPromise = createWaiter(
      {
        ...minimalWaiterConfig,
        maxWaitTime: 20,
      },
      input,
      mockAcceptorChecks
    );
    vi.advanceTimersByTime(minimalWaiterConfig.minDelay * 1000);
    expect(await statusPromise).toMatchObject(failureState);
  });
});
