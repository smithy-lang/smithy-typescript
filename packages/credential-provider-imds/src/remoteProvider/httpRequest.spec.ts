import { ProviderError } from "@smithy/property-provider";
import { afterEach, describe, expect, test as it, vi } from "vitest";

import { httpRequest } from "./httpRequest";

vi.mock("http", async () => {
  const actual: any = vi.importActual("http");

  const pkg = {
    ...actual,
    request: vi.fn(),
  };
  return {
    ...pkg,
    default: pkg,
  };
});

import EventEmitter from "events";
import { request } from "http";

describe("httpRequest", () => {
  let port: number;
  const hostname = "localhost";
  const path = "/";

  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockResponse({ expectedResponse, statusCode = 200 }: any) {
    return vi.mocked(request).mockImplementationOnce((() => {
      const request = Object.assign(new EventEmitter(), {
        destroy: vi.fn(),
        end: vi.fn(),
      });
      const response = new EventEmitter() as any;
      response.statusCode = statusCode;
      setTimeout(() => {
        request.emit("response", response);
        setTimeout(() => {
          response.emit("data", Buffer.from(expectedResponse));
          response.emit("end");
        }, 50);
      }, 50);
      return request;
    }) as any);
  }

  describe("returns response", () => {
    it("defaults to method GET", async () => {
      const expectedResponse = "expectedResponse";

      mockResponse({ expectedResponse });

      const response = await httpRequest({ hostname, path, port });
      expect(response.toString()).toStrictEqual(expectedResponse);
    });

    it("uses method passed in options", async () => {
      const method = "POST";
      const expectedResponse = "expectedResponse";
      mockResponse({ expectedResponse });

      const response = await httpRequest({ hostname, path, port, method });
      expect(response.toString()).toStrictEqual(expectedResponse);
    });

    it("works with IPv6 hostname with encapsulated brackets", async () => {
      const expectedResponse = "expectedResponse";
      const encapsulatedIPv6Hostname = "[::1]";
      mockResponse({ expectedResponse });

      const response = await httpRequest({ hostname: encapsulatedIPv6Hostname, path, port });
      expect(response.toString()).toStrictEqual(expectedResponse);
    });
  });

  describe("throws error", () => {
    const errorOnStatusCode = async (statusCode: number) => {
      it(`statusCode: ${statusCode}`, async () => {
        mockResponse({
          statusCode,
          expectedResponse: "continue",
        });

        await expect(httpRequest({ hostname, path, port })).rejects.toStrictEqual(
          Object.assign(new ProviderError("Error response received from instance metadata service"), { statusCode })
        );
      });
    };

    it("when request throws error", async () => {
      vi.mocked(request).mockImplementationOnce((() => {
        const request = Object.assign(new EventEmitter(), {
          destroy: vi.fn(),
          end: vi.fn(),
        });
        setTimeout(() => {
          request.emit("error");
        }, 50);
        return request;
      }) as any);

      await expect(httpRequest({ hostname, path, port })).rejects.toStrictEqual(
        new ProviderError("Unable to connect to instance metadata service")
      );
    });

    describe("when request returns with statusCode < 200", () => {
      [100, 101, 103].forEach(errorOnStatusCode);
    });

    describe("when request returns with statusCode >= 300", () => {
      [300, 400, 500].forEach(errorOnStatusCode);
    });
  });

  it("timeout", async () => {
    const timeout = 1000;
    vi.mocked(request).mockImplementationOnce((() => {
      const request = Object.assign(new EventEmitter(), {
        destroy: vi.fn(),
        end: vi.fn(),
      });
      const response = new EventEmitter() as any;
      response.statusCode = 200;
      setTimeout(() => {
        request.emit("timeout");
      }, 50);
      return request;
    }) as any);

    await expect(httpRequest({ hostname, path, port, timeout })).rejects.toStrictEqual(
      new ProviderError("TimeoutError from instance metadata service")
    );
  });
});
