import EventEmitter from "events";
import { describe, expect, test as it, vi } from "vitest";

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
    let done: (value?: unknown) => void;
    const promise = new Promise((r) => (done = r));
    setTimeout(async () => {
      httpRequest.emit("continue", {});
      done();
    }, 25);
    await writeRequestBody(httpRequest, request);
    expect(httpRequest.end).toHaveBeenCalled();
    await promise;
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
      let done: (value?: unknown) => void;
      const promise = new Promise((r) => (done = r));
      setTimeout(() => {
        httpRequest.emit("response", {});
        done();
      }, 25);
      await writeRequestBody(httpRequest, request);
      expect(request.body.pipe).not.toHaveBeenCalled();
      expect(httpRequest.end).not.toHaveBeenCalled();
      await promise;
    }
  );

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

    const promise = writeRequestBody(httpRequest, request);
    expect(httpRequest.end).not.toHaveBeenCalled();
    await promise;
    expect(httpRequest.end).toHaveBeenCalled();
  });
});
