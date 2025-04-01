import EventEmitter from "events";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { setConnectionTimeout } from "./set-connection-timeout";
import { timing } from "./timing";

describe("setConnectionTimeout", () => {
  const reject = vi.fn();
  const clientRequest: any = {
    on: vi.fn(),
    destroy: vi.fn(),
  };

  vi.spyOn(timing, "setTimeout").mockImplementation(((fn: Function, ms: number) => {
    return setTimeout(fn, ms);
  }) as any);
  vi.spyOn(timing, "clearTimeout").mockImplementation(((timer: any) => {
    return clearTimeout(timer);
  }) as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("will not attach listeners if timeout is 0", () => {
    setConnectionTimeout(clientRequest, reject, 0);
    expect(clientRequest.on).not.toHaveBeenCalled();
  });

  it("will not attach listeners if timeout is not provided", () => {
    setConnectionTimeout(clientRequest, reject);
    expect(clientRequest.on).not.toHaveBeenCalled();
  });

  describe("when timeout is provided", () => {
    const timeoutInMs = 100;
    const mockSocket = {
      connecting: true,
      on: vi.fn(),
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.advanceTimersByTime(10000);
      vi.useRealTimers();
    });

    it("attaches listener", () => {
      setConnectionTimeout(clientRequest, reject, timeoutInMs);
      expect(clientRequest.on).toHaveBeenCalledTimes(1);
      expect(clientRequest.on).toHaveBeenCalledWith("socket", expect.any(Function));
    });

    it("doesn't set timeout if socket is already connected", () => {
      setConnectionTimeout(clientRequest, reject, timeoutInMs);
      expect(mockSocket.on).not.toHaveBeenCalled();
      expect(timing.setTimeout).toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
    });

    it("rejects and aborts request if socket isn't connected by timeout", async () => {
      setConnectionTimeout(clientRequest, reject, timeoutInMs);
      clientRequest.on.mock.calls[0][1](mockSocket);
      expect(timing.setTimeout).toHaveBeenCalledTimes(1);
      expect(timing.setTimeout).toHaveBeenCalledWith(expect.any(Function), timeoutInMs);
      expect(mockSocket.on).toHaveBeenCalledTimes(1);
      expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));

      expect(clientRequest.destroy).not.toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();

      // Fast-forward until timer has been executed.
      vi.advanceTimersByTime(timeoutInMs);
      expect(clientRequest.destroy).toHaveBeenCalledTimes(1);
      expect(reject).toHaveBeenCalledTimes(1);
      expect(reject).toHaveBeenCalledWith(
        Object.assign(new Error(`Socket timed out without establishing a connection within ${timeoutInMs} ms`), {
          name: "TimeoutError",
        })
      );
    });

    it("calls socket operations directly if socket is available", async () => {
      setConnectionTimeout(clientRequest, reject, timeoutInMs);
      const request = {
        on: vi.fn(),
        socket: {
          on: vi.fn(),
          connecting: true,
        },
        destroy() {},
      } as any;
      setConnectionTimeout(request, () => {}, 1);
      vi.runAllTimers();

      expect(request.socket.on).toHaveBeenCalled();
      expect(request.on).not.toHaveBeenCalled();
    });

    it("clears timeout if socket gets connected", () => {
      const socket = new EventEmitter() as any;
      socket.connecting = true;

      setConnectionTimeout(
        {
          ...clientRequest,
          socket,
        },
        reject,
        timeoutInMs
      );

      expect(clientRequest.destroy).not.toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
      expect(timing.clearTimeout).not.toHaveBeenCalled();

      // Fast-forward for half the amount of time and call connect callback to clear timer.
      vi.advanceTimersByTime(timeoutInMs / 2);
      socket.emit("connect");

      expect(timing.clearTimeout).toHaveBeenCalled();

      // Fast-forward until timer has been executed.
      vi.runAllTimers();
      expect(clientRequest.destroy).not.toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
    });
  });
});
