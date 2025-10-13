import { beforeEach, describe, expect, test as it, vi } from "vitest";

import { setRequestTimeout } from "./set-request-timeout";

describe("setRequestTimeout", () => {
  const reject = vi.fn();
  const clientRequest: any = {
    destroy: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns -1 if no timeout is given", () => {
    {
      const id = setRequestTimeout(clientRequest, reject, 0);
      expect(id).toEqual(-1);
    }
    {
      const id = setRequestTimeout(clientRequest, reject, undefined);
      expect(id).toEqual(-1);
    }
  });

  describe("when timeout is provided", () => {
    it("rejects after the timeout", async () => {
      setRequestTimeout(clientRequest, reject, 1, true);
      await new Promise((r) => setTimeout(r, 2));
      expect(reject).toHaveBeenCalledWith(
        Object.assign(
          new Error(
            `@smithy/node-http-handler - [ERROR] a request has exceeded the configured ${1} ms requestTimeout.`
          ),
          {
            name: "TimedoutError",
            code: "ETIMEDOUT",
          }
        )
      );
      expect(clientRequest.destroy).toHaveBeenCalled();
    });

    it("logs a warning", async () => {
      const logger = {
        ...console,
        warn: vi.fn(),
      };
      setRequestTimeout(clientRequest, reject, 1, false, logger);
      await new Promise((r) => setTimeout(r, 2));
      expect(logger.warn).toHaveBeenCalledWith(
        `@smithy/node-http-handler - [WARN] a request has exceeded the configured ${1} ms requestTimeout.` +
          ` Init client requestHandler with throwOnRequestTimeout=true to turn this into an error.`
      );
      expect(clientRequest.destroy).not.toHaveBeenCalled();
    });
  });
});
