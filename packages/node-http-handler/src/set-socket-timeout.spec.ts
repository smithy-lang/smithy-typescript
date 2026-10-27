import { EventEmitter } from "node:events";
import { afterAll, beforeEach, describe, expect, test as it, vi } from "vitest";

import { setSocketTimeout } from "./set-socket-timeout";
import { timing } from "./timing";

describe("setSocketTimeout", () => {
  const clientRequest: any = {
    destroy: vi.fn(),
    socket: { setTimeout: vi.fn() },
    on: vi.fn(),
    once: vi.fn(),
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

  it(`sets the socket's timeout if provided`, () => {
    setSocketTimeout(clientRequest, vi.fn(), 100);

    expect(clientRequest.socket.setTimeout).toHaveBeenCalledTimes(1);
    expect(clientRequest.socket.setTimeout).toHaveBeenLastCalledWith(100, expect.any(Function));
  });

  it(`sets the socket's timeout to 0 if not provided`, async () => {
    setSocketTimeout(clientRequest, vi.fn());

    vi.runAllTimers();

    expect(clientRequest.socket.setTimeout).toHaveBeenCalledTimes(1);
    expect(clientRequest.socket.setTimeout).toHaveBeenLastCalledWith(0, expect.any(Function));
  });

  it("waits for a connecting socket before starting its idle timeout", () => {
    for (const assigned of [true, false]) {
      const socket = Object.assign(new EventEmitter(), { connecting: true, setTimeout: vi.fn() });
      const request = Object.assign(new EventEmitter(), { socket: assigned ? socket : undefined });
      setSocketTimeout(request as any, vi.fn(), 1000);
      if (!assigned) {
        request.socket = socket;
        request.emit("socket", socket);
      }

      expect(socket.setTimeout).not.toHaveBeenCalled();
      socket.connecting = false;
      socket.emit("connect");
      expect(socket.setTimeout).toHaveBeenCalledExactlyOnceWith(1000, expect.any(Function));
    }
  });

  it("keeps the socket timeout after an early response ends before the upload finishes", () => {
    const socket = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn((ms: number, onTimeout: () => void) => socket.on("timeout", onTimeout)),
      destroy: vi.fn(),
    });
    const request = Object.assign(new EventEmitter(), {
      socket: undefined as typeof socket | undefined,
      setTimeout: vi.fn(),
      destroy: vi.fn(),
      writableFinished: false,
    });
    const reject = vi.fn();
    setSocketTimeout(request as any, reject, 1000);
    request.socket = socket;
    request.emit("socket", socket);
    const response = { complete: true, destroy: vi.fn() };
    request.emit("response", response);
    // Node removes its request timeout forwarding listener when the response ends.
    request.removeAllListeners("timeout");

    expect(socket.setTimeout).toHaveBeenCalledWith(1000, expect.any(Function));
    socket.emit("timeout");
    expect(socket.destroy).toHaveBeenCalledTimes(1);
    expect(request.destroy).not.toHaveBeenCalled();
    expect(response.destroy).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();

    request.emit("close");
    expect(socket.listenerCount("timeout")).toBe(0);
  });

  describe("event listener registration deferral", () => {
    const clientRequestWithSocket: any = {
      destroy: vi.fn(),
      setTimeout: vi.fn(),
      socket: {
        setTimeout: vi.fn(),
      },
      on: vi.fn(),
      once: vi.fn(),
    };

    it("calls setTimeout on the socket if it is available after service-default deferral", async () => {
      const eventListenerMinimumTimeoutToDefer = 6000;
      setSocketTimeout(clientRequestWithSocket, vi.fn(), eventListenerMinimumTimeoutToDefer, true);

      vi.runAllTimers();

      expect(clientRequestWithSocket.socket.setTimeout).toHaveBeenCalledTimes(1);
      expect(clientRequestWithSocket.socket.setTimeout).toHaveBeenLastCalledWith(
        eventListenerMinimumTimeoutToDefer - 3000,
        expect.any(Function)
      );
      expect(clientRequestWithSocket.on).toHaveBeenCalledTimes(1);
      expect(clientRequestWithSocket.on).toHaveBeenLastCalledWith("close", expect.any(Function));
    });
  });

  describe("destroyResponseBodyOnTimeout", () => {
    const makeRequest = () => {
      const listeners: Record<string, Function> = {};
      return {
        destroy: vi.fn(),
        writableFinished: true,
        setTimeout: vi.fn(),
        socket: { setTimeout: vi.fn(), removeListener: vi.fn(), destroy: vi.fn() },
        on: vi.fn(),
        once: vi.fn((event: string, fn: Function) => (listeners[event] = fn)),
        res: { destroy: vi.fn() },
        emit(event: string) {
          listeners[event]?.(event === "response" ? this.res : undefined);
        },
      } as any;
    };

    it.each([6000, 300000])("registers a configured %i ms timeout immediately", (timeoutInMs) => {
      const request = makeRequest();
      setSocketTimeout(request, vi.fn(), timeoutInMs);

      expect(request.socket.setTimeout).toHaveBeenCalledTimes(1);
    });

    it.each([6000, 300000])("arms the full configured %i ms window at registration", (timeoutInMs) => {
      const request = makeRequest();
      setSocketTimeout(request, vi.fn(), timeoutInMs);

      expect(request.socket.setTimeout).toHaveBeenCalledWith(timeoutInMs, expect.any(Function));
    });

    it("times out a stalled body after fast headers with the full configured idle window", () => {
      const request = makeRequest();
      const reject = vi.fn();
      const id = setSocketTimeout(request, reject, 30000);

      vi.advanceTimersByTime(100);
      request.emit("response");
      timing.clearTimeout(id);
      vi.advanceTimersByTime(2900);

      expect(request.socket.setTimeout).toHaveBeenCalledWith(30000, expect.any(Function));
      expect(request.destroy).not.toHaveBeenCalled();
      request.socket.setTimeout.mock.calls[0][1]();
      expect(request.destroy).toHaveBeenCalledTimes(1);
      expect(reject).toHaveBeenCalledWith(expect.objectContaining({ name: "TimeoutError" }));
    });

    it("keeps the deferred registration when the handler clears its timeouts on headers", () => {
      const request = makeRequest();
      const id = setSocketTimeout(request, vi.fn(), 300000, true);
      expect(id).toBe(0);
      timing.clearTimeout(id);

      vi.advanceTimersByTime(3000);
      expect(request.socket.setTimeout).toHaveBeenCalledWith(297000, expect.any(Function));
    });

    it("registers nothing on early close for the service default", () => {
      const request = makeRequest();
      setSocketTimeout(request, vi.fn(), 300000, true);
      request.emit("close");

      vi.runAllTimers();
      expect(request.socket.setTimeout).not.toHaveBeenCalled();
    });

    it.each([false, true])(
      "preserves a response completed after registration (destroyResponseBodyOnTimeout=%s)",
      (destroyResponseBodyOnTimeout) => {
        const request = makeRequest();
        setSocketTimeout(request, vi.fn(), 6000, destroyResponseBodyOnTimeout);
        request.emit("response");
        vi.advanceTimersByTime(3000);
        request.res.complete = true;

        request.socket.setTimeout.mock.calls[0][1]();
        expect({ body: request.res.destroy.mock.calls, request: request.destroy.mock.calls }).toEqual({
          body: [],
          request: [],
        });
      }
    );

    it.each([false, true])(
      "closes a stalled upload without destroying its complete response (destroyResponseBodyOnTimeout=%s)",
      (destroyResponseBodyOnTimeout) => {
        const request = makeRequest();
        const reject = vi.fn();
        request.writableFinished = false;
        setSocketTimeout(request, reject, 6000, destroyResponseBodyOnTimeout);
        request.emit("response");
        vi.advanceTimersByTime(3000);
        request.res.complete = true;

        request.socket.setTimeout.mock.calls[0][1]();
        expect(request.socket.destroy).toHaveBeenCalledTimes(1);
        expect(request.res.destroy).not.toHaveBeenCalled();
        expect(request.destroy).not.toHaveBeenCalled();
        expect(reject).not.toHaveBeenCalled();
      }
    );

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

    it("fails a configured response body with the TimeoutError", () => {
      const request = makeRequest();
      setSocketTimeout(request, vi.fn(), 1000);
      request.emit("response");

      request.socket.setTimeout.mock.calls[0][1]();
      expect(request.res.destroy).toHaveBeenCalledWith(expect.objectContaining({ name: "TimeoutError" }));
    });
  });

  it(`destroys the request on timeout`, () => {
    setSocketTimeout(clientRequest, vi.fn(), 1);
    expect(clientRequest.destroy).not.toHaveBeenCalled();

    // call setTimeout callback
    clientRequest.socket.setTimeout.mock.calls[0][1]();
    expect(clientRequest.destroy).toHaveBeenCalledTimes(1);
  });

  it(`rejects on timeout with a TimeoutError`, () => {
    const reject = vi.fn();
    const timeoutInMs = 100;

    setSocketTimeout(clientRequest, reject, timeoutInMs);
    expect(reject).not.toHaveBeenCalled();

    // call setTimeout callback
    clientRequest.socket.setTimeout.mock.calls[0][1]();
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
