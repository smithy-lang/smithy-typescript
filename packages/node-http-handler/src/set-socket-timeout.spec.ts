import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, test as it, vi } from "vitest";

import { setSocketTimeout } from "./set-socket-timeout";

describe("setSocketTimeout", () => {
  const clientRequest: any = {
    destroy: vi.fn(),
    socket: { setTimeout: vi.fn() },
    on: vi.fn(),
    once: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(`sets the socket's timeout if provided`, () => {
    setSocketTimeout(clientRequest, vi.fn(), 100);

    expect(clientRequest.socket.setTimeout).toHaveBeenCalledTimes(1);
    expect(clientRequest.socket.setTimeout).toHaveBeenLastCalledWith(100, expect.any(Function));
  });

  it.each([undefined, 0, -1, NaN, Infinity])(`does not register a socket timeout for %p`, (timeoutInMs) => {
    setSocketTimeout(clientRequest, vi.fn(), timeoutInMs);

    expect(clientRequest.socket.setTimeout).not.toHaveBeenCalled();
    expect(clientRequest.once).not.toHaveBeenCalled();
  });

  it("waits for a connecting socket before starting its idle timeout", () => {
    for (const assigned of [true, false]) {
      const socket = Object.assign(new EventEmitter(), {
        connecting: true,
        setTimeout: vi.fn(),
      });
      const request = Object.assign(new EventEmitter(), {
        socket: assigned ? socket : undefined,
      });
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

  describe("timeout behavior", () => {
    const makeRequest = () => {
      const listeners: Record<string, Function> = {};
      return {
        destroy: vi.fn(),
        setTimeout: vi.fn(),
        socket: {
          setTimeout: vi.fn(),
          removeListener: vi.fn(),
          destroy: vi.fn(),
        },
        on: vi.fn(),
        once: vi.fn((event: string, fn: Function) => (listeners[event] = fn)),
        res: { destroy: vi.fn() },
        emit(event: string) {
          listeners[event]?.(event === "response" ? this.res : undefined);
        },
      } as any;
    };

    it.each([
      [6000, false],
      [300000, false],
      [300000, true],
    ])("arms the full %i ms window immediately (isServiceDefault=%s)", (timeoutInMs, isServiceDefault) => {
      const request = makeRequest();
      setSocketTimeout(request, vi.fn(), timeoutInMs, isServiceDefault);

      expect(request.socket.setTimeout).toHaveBeenCalledExactlyOnceWith(timeoutInMs, expect.any(Function));
    });

    it("times out a stalled body after fast headers with the full configured idle window", () => {
      const request = makeRequest();
      const reject = vi.fn();
      setSocketTimeout(request, reject, 30000);

      request.emit("response");

      expect(request.socket.setTimeout).toHaveBeenCalledWith(30000, expect.any(Function));
      expect(request.destroy).not.toHaveBeenCalled();
      request.socket.setTimeout.mock.calls[0][1]();
      expect(request.destroy).toHaveBeenCalledTimes(1);
      expect(reject).toHaveBeenCalledWith(expect.objectContaining({ name: "TimeoutError" }));
    });

    it.each([
      [false, true],
      [true, true],
      [false, false],
      [true, false],
    ])(
      "frees the socket and keeps a complete response readable (isServiceDefault=%s, uploadFinished=%s)",
      (isServiceDefault, uploadFinished) => {
        const request = makeRequest();
        const reject = vi.fn();
        request.writableFinished = uploadFinished;
        setSocketTimeout(request, reject, 6000, isServiceDefault);
        request.emit("response");
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
