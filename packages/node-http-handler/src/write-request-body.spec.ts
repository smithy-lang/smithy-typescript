import EventEmitter from "events";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { writeRequestBody } from "./write-request-body";

describe(writeRequestBody.name, () => {
  it("should wait for the continue event if request has expect=100-continue", async () => {
    const httpRequest = Object.assign(new EventEmitter(), {
      end: vi.fn(),
    }) as any;
    const request = {
      headers: {
        expect: "100-continue",
      },
      body: Buffer.from("abcd"),
      method: "GET",
      hostname: "",
      protocol: "https:",
      path: "/",
    };
    setTimeout(async () => {
      httpRequest.emit("continue", {});
    }, 200);
    const promise = writeRequestBody(httpRequest, request);
    expect(httpRequest.end).not.toHaveBeenCalled();
    await promise;
    expect(httpRequest.end).toHaveBeenCalled();
  });

  it("should not wait for the continue event if request has expect=100-continue but agent is external", async () => {
    const httpRequest = Object.assign(new EventEmitter(), {
      end: vi.fn(),
    }) as any;
    const request = {
      headers: {
        expect: "100-continue",
      },
      body: Buffer.from("abcd"),
      method: "GET",
      hostname: "",
      protocol: "https:",
      path: "/",
    };
    const id = setTimeout(async () => {
      httpRequest.emit("continue", {});
    }, 200);
    const promise = writeRequestBody(httpRequest, request, 6000, true);
    expect(httpRequest.end).toHaveBeenCalled();
    await promise;
    clearTimeout(id);
  });

  it(
    "should not send the body if the request is expect=100-continue" +
      "but a response is received before the continue event",
    async () => {
      const httpRequest = Object.assign(new EventEmitter(), {
        end: vi.fn(),
      }) as any;
      const request = {
        headers: {
          expect: "100-continue",
        },
        body: {
          pipe: vi.fn(),
        },
        method: "GET",
        hostname: "",
        protocol: "https:",
        path: "/",
      };
      setTimeout(() => {
        httpRequest.emit("response", {});
      }, 25);
      await writeRequestBody(httpRequest, request);
      expect(request.body.pipe).not.toHaveBeenCalled();
      expect(httpRequest.end).not.toHaveBeenCalled();
    }
  );

  describe("with fake timers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });
    it("should send the body if the 100 Continue response is not received before the timeout", async () => {
      const httpRequest = Object.assign(new EventEmitter(), {
        end: vi.fn(),
      }) as any;
      const request = {
        headers: {
          expect: "100-continue",
        },
        body: Buffer.from("abcd"),
        method: "GET",
        hostname: "",
        protocol: "https:",
        path: "/",
      };

      const promise = writeRequestBody(httpRequest, request, 12_000);
      expect(httpRequest.end).not.toHaveBeenCalled();
      vi.advanceTimersByTime(13000);
      await promise;

      expect(httpRequest.end).toHaveBeenCalled();
    });
  });
});
