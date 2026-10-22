import { afterAll, beforeEach, describe, expect, test as it, vi } from "vitest";

import { setSocketTimeout } from "./set-socket-timeout";
import { timing } from "./timing";

describe("setSocketTimeout", () => {
  const clientRequest: any = {
    destroy: vi.fn(),
    setTimeout: vi.fn(),
  };

  vi.spyOn(timing, "setTimeout").mockImplementation(((fn: Function, ms: number) => {
    return setTimeout(fn, ms);
  }) as any);
  vi.spyOn(timing, "clearTimeout").mockImplementation(((timer: any) => {
    return clearTimeout(timer);
  }) as any);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it(`sets the request's timeout if provided`, () => {
    setSocketTimeout(clientRequest, vi.fn(), 100);

    expect(clientRequest.setTimeout).toHaveBeenCalledTimes(1);
    expect(clientRequest.setTimeout).toHaveBeenLastCalledWith(100, expect.any(Function));
  });

  it(`sets the request's timeout to 0 if not provided`, async () => {
    setSocketTimeout(clientRequest, vi.fn());

    vi.runAllTimers();

    expect(clientRequest.setTimeout).toHaveBeenCalledTimes(1);
    expect(clientRequest.setTimeout).toHaveBeenLastCalledWith(0, expect.any(Function));
  });

  describe("event listener registration deferral", () => {
    const clientRequestWithSocket: any = {
      destroy: vi.fn(),
      setTimeout: vi.fn(),
      socket: {
        setTimeout: vi.fn(),
      },
      on: vi.fn(),
    };

    it("calls setTimeout on the socket if it is available after deferral", async () => {
      const eventListenerMinimumTimeoutToDefer = 6000;
      const deferralTimeout = 3000;
      const expectedDeferredSocketTimeout = eventListenerMinimumTimeoutToDefer - deferralTimeout;
      setSocketTimeout(clientRequestWithSocket, vi.fn(), eventListenerMinimumTimeoutToDefer);

      vi.runAllTimers();

      expect(clientRequestWithSocket.socket.setTimeout).toHaveBeenCalledTimes(1);
      expect(clientRequestWithSocket.socket.setTimeout).toHaveBeenLastCalledWith(
        expectedDeferredSocketTimeout,
        expect.any(Function)
      );
      expect(clientRequestWithSocket.on).toHaveBeenCalledTimes(1);
      expect(clientRequestWithSocket.on).toHaveBeenLastCalledWith("close", expect.any(Function));
    });
  });

  describe("failResponseBody", () => {
    const makeRequest = () => {
      const listeners: Record<string, Function> = {};
      return {
        destroy: vi.fn(),
        setTimeout: vi.fn(),
        socket: { setTimeout: vi.fn(), removeListener: vi.fn() },
        on: vi.fn(),
        once: vi.fn((event: string, fn: Function) => (listeners[event] = fn)),
        res: { destroy: vi.fn() },
        emit(event: string) {
          listeners[event]?.(event === "response" ? this.res : undefined);
        },
      } as any;
    };

    it("keeps the deferred registration when the handler clears its timeouts on headers", () => {
      const request = makeRequest();
      const id = setSocketTimeout(request, vi.fn(), 300000, true);
      expect(id).toBe(0);
      timing.clearTimeout(id);

      vi.advanceTimersByTime(3000);
      expect(request.socket.setTimeout).toHaveBeenCalledWith(297000, expect.any(Function));
    });

    it("registers nothing when the request closes within the deferral", () => {
      const request = makeRequest();
      setSocketTimeout(request, vi.fn(), 300000, true);
      request.emit("close");

      vi.runAllTimers();
      expect(request.socket.setTimeout).not.toHaveBeenCalled();
    });

    it("fails the response body with the TimeoutError on timeout", () => {
      const request = makeRequest();
      const reject = vi.fn();
      setSocketTimeout(request, reject, 300000, true);
      request.emit("response");
      vi.advanceTimersByTime(3000);

      request.socket.setTimeout.mock.calls[0][1]();
      const error = reject.mock.calls[0][0];
      expect(error.name).toBe("TimeoutError");
      expect(error.message).toContain("(service default socket timeout)");
      expect(request.res.destroy).toHaveBeenCalledWith(error);
      expect(request.destroy).toHaveBeenCalledTimes(1);
    });

    it("leaves the response alone without the option", () => {
      const request = makeRequest();
      setSocketTimeout(request, vi.fn(), 1000);

      request.socket.setTimeout.mock.calls[0][1]();
      expect(request.res.destroy).not.toHaveBeenCalled();
    });
  });

  it(`destroys the request on timeout`, () => {
    setSocketTimeout(clientRequest, vi.fn(), 1);
    expect(clientRequest.destroy).not.toHaveBeenCalled();

    // call setTimeout callback
    clientRequest.setTimeout.mock.calls[0][1]();
    expect(clientRequest.destroy).toHaveBeenCalledTimes(1);
  });

  it(`rejects on timeout with a TimeoutError`, () => {
    const reject = vi.fn();
    const timeoutInMs = 100;

    setSocketTimeout(clientRequest, reject, timeoutInMs);
    expect(reject).not.toHaveBeenCalled();

    // call setTimeout callback
    clientRequest.setTimeout.mock.calls[0][1]();
    expect(reject).toHaveBeenCalledTimes(1);
    expect(reject).toHaveBeenCalledWith(
      Object.assign(
        new Error(
          `@smithy/node-http-handler - the request socket timed out after ${timeoutInMs} ms of inactivity (configured by client requestHandler).`
        ),
        { name: "TimeoutError" }
      )
    );
  });
});
