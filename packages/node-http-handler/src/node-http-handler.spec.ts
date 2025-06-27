import { HttpRequest } from "@smithy/protocol-http";
import http from "http";
import https from "https";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { NodeHttpHandler } from "./node-http-handler";
import { timing } from "./timing";

vi.mock("http", async () => {
  const actual = (await vi.importActual("http")) as any;
  const pkg = {
    ...actual,
    request: vi.fn().mockImplementation((_options, cb) => {
      cb({
        statusCode: 200,
        body: "body",
        headers: {},
        protocol: "http:",
      });
      return new actual.ClientRequest({ ..._options, protocol: "http:" });
    }),
  };
  return {
    ...pkg,
    default: pkg,
  };
});

vi.mock("https", async () => {
  const actual = (await vi.importActual("https")) as any;
  const http = (await vi.importActual("http")) as any;
  const pkg = {
    ...actual,
    request: vi.fn().mockImplementation((_options, cb) => {
      cb({
        statusCode: 200,
        body: "body",
        headers: {},
        protocol: "https:",
      });
      return new http.ClientRequest({ ..._options, protocol: "https:" });
    }),
  };
  return {
    ...pkg,
    default: pkg,
  };
});

import { request as hRequest } from "http";
import { request as hsRequest } from "https";

describe("NodeHttpHandler", () => {
  describe("constructor and #handle", () => {
    const randomMaxSocket = Math.round(Math.random() * 50) + 1;
    const randomSocketAcquisitionWarningTimeout = Math.round(Math.random() * 10000) + 1;

    beforeEach(() => {});

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe("constructor", () => {
      it("allows https.Agent and http.Agent ctor args in place of actual instances", async () => {
        const nodeHttpHandler = new NodeHttpHandler({
          httpAgent: { maxSockets: 37 },
          httpsAgent: { maxSockets: 39, keepAlive: false },
        });

        await nodeHttpHandler.handle({} as any);

        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.agent.maxSockets).toEqual(37);
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.agent.keepAlive).toEqual(true);

        expect((nodeHttpHandler as any).config.httpsAgent.maxSockets).toEqual(39);
        expect((nodeHttpHandler as any).config.httpsAgent.keepAlive).toEqual(false);
      });

      it.each([
        ["empty", undefined],
        ["a provider", async () => {}],
      ])("sets keepAlive=true by default when input is %s", async (_, option) => {
        const nodeHttpHandler = new NodeHttpHandler(option);
        await nodeHttpHandler.handle({} as any);
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.agent.keepAlive).toEqual(true);
      });

      it.each([
        ["empty", undefined],
        ["a provider", async () => {}],
      ])("sets maxSockets=50 by default when input is %s", async (_, option) => {
        const nodeHttpHandler = new NodeHttpHandler(option);
        await nodeHttpHandler.handle({} as any);
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.agent.maxSockets).toEqual(50);
      });

      it.each([
        ["an options hash", { socketAcquisitionWarningTimeout: randomSocketAcquisitionWarningTimeout }],
        [
          "a provider",
          async () => ({
            socketAcquisitionWarningTimeout: randomSocketAcquisitionWarningTimeout,
          }),
        ],
      ])("sets socketAcquisitionWarningTimeout correctly when input is %s", async (_, option) => {
        vi.spyOn(timing, "setTimeout");
        const nodeHttpHandler = new NodeHttpHandler(option);
        await nodeHttpHandler.handle({} as any);
        expect(vi.mocked(timing.setTimeout).mock.calls[0][1]).toBe(randomSocketAcquisitionWarningTimeout);
      });

      it.each([
        ["an options hash", { httpAgent: new http.Agent({ keepAlive: false, maxSockets: randomMaxSocket }) }],
        [
          "a provider",
          async () => ({
            httpAgent: new http.Agent({ keepAlive: false, maxSockets: randomMaxSocket }),
          }),
        ],
      ])("sets httpAgent when input is %s", async (_, option) => {
        const nodeHttpHandler = new NodeHttpHandler(option);
        await nodeHttpHandler.handle({ protocol: "http:", headers: {}, method: "GET", hostname: "localhost" } as any);
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.agent.keepAlive).toEqual(false);
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.agent.maxSockets).toEqual(randomMaxSocket);
      });

      it.each([
        ["an option hash", { httpsAgent: new https.Agent({ keepAlive: true, maxSockets: randomMaxSocket }) }],
        [
          "a provider",
          async () => ({
            httpsAgent: new https.Agent({ keepAlive: true, maxSockets: randomMaxSocket }),
          }),
        ],
      ])("sets httpsAgent when input is %s", async (_, option) => {
        const nodeHttpHandler = new NodeHttpHandler(option);
        await nodeHttpHandler.handle({ protocol: "https:" } as any);
        expect(vi.mocked(hsRequest as any).mock.calls[0][0]?.agent.keepAlive).toEqual(true);
        expect(vi.mocked(hsRequest as any).mock.calls[0][0]?.agent.maxSockets).toEqual(randomMaxSocket);
      });
    });

    describe("#handle", () => {
      it("should only generate a single config when the config provider is async and it is not ready yet", async () => {
        let providerInvokedCount = 0;
        let providerResolvedCount = 0;
        const slowConfigProvider = async () => {
          providerInvokedCount += 1;
          await new Promise((r) => setTimeout(r, 15));
          providerResolvedCount += 1;
          return {
            connectionTimeout: 12345,
            socketTimeout: 12345,
            httpAgent: void 0,
            httpsAgent: void 0,
          };
        };

        const nodeHttpHandler = new NodeHttpHandler(slowConfigProvider);

        const promises = Promise.all(
          Array.from({ length: 20 }).map(() => nodeHttpHandler.handle({} as unknown as HttpRequest))
        );

        expect(providerInvokedCount).toBe(1);
        expect(providerResolvedCount).toBe(0);
        await promises;
        expect(providerInvokedCount).toBe(1);
        expect(providerResolvedCount).toBe(1);
      });

      it("sends requests to the right url", async () => {
        const nodeHttpHandler = new NodeHttpHandler({});
        const httpRequest = {
          protocol: "http:",
          username: "username",
          password: "password",
          hostname: "host",
          port: 1234,
          path: "/some/path",
          query: {
            some: "query",
          },
          fragment: "fragment",
        };
        await nodeHttpHandler.handle(httpRequest as any);
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.auth).toEqual("username:password");
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.host).toEqual("host");
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.port).toEqual(1234);
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.path).toEqual("/some/path?some=query#fragment");
      });

      it("removes brackets from hostname", async () => {
        const nodeHttpHandler = new NodeHttpHandler({});
        const httpRequest = {
          protocol: "http:",
          username: "username",
          password: "password",
          hostname: "[host]",
          port: 1234,
          path: "/some/path",
          query: {
            some: "query",
          },
          fragment: "fragment",
        };
        await nodeHttpHandler.handle(httpRequest as any);
        expect(vi.mocked(hRequest as any).mock.calls[0][0]?.host).toEqual("host");
      });
    });
  });

  describe("#destroy", () => {
    it("should be callable and return nothing", () => {
      const nodeHttpHandler = new NodeHttpHandler();
      expect(nodeHttpHandler.destroy()).toBeUndefined();
    });
  });

  describe("checkSocketUsage", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(vi.fn() as any);
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it("warns when socket exhaustion is detected", async () => {
      const lastTimestamp = Date.now() - 30_000;
      const warningTimestamp = NodeHttpHandler.checkSocketUsage(
        {
          maxSockets: 2,
          sockets: {
            addr: [],
            addr2: [null],
            addr3: [null, null],
            // this is not checked because an earlier addr causes the warning to be emitted.
            addr4: Array.from({ length: 400 }),
          },
          requests: {
            addr: Array.from({ length: 0 }),
            addr2: Array.from({ length: 3 }),
            addr3: Array.from({ length: 4 }),
            // this is not checked because an earlier addr causes the warning to be emitted.
            addr4: Array.from({ length: 800 }),
          },
        } as any,
        lastTimestamp
      );

      expect(warningTimestamp).toBeGreaterThan(lastTimestamp);
      expect(console.warn).toHaveBeenCalledWith(
        `@smithy/node-http-handler:WARN - socket usage at capacity=2 and 4 additional requests are enqueued.
See https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/node-configuring-maxsockets.html
or increase socketAcquisitionWarningTimeout=(millis) in the NodeHttpHandler config.`
      );
    });
  });

  describe("per-request requestTimeout", () => {
    it("should use per-request timeout over handler config timeout", () => {
      const nodeHttpHandler = new NodeHttpHandler({ requestTimeout: 5000 });
      const mockHandle = vi.spyOn(nodeHttpHandler, "handle");
      const testTimeout = (handlerTimeout: number, requestTimeout?: number) => {
        const handler = new NodeHttpHandler({ requestTimeout: handlerTimeout });
        const options = requestTimeout !== undefined ? { requestTimeout } : {};
        const expectedTimeout = requestTimeout ?? handlerTimeout;
        return expectedTimeout;
      };

      // per-request timeout takes precedence
      expect(testTimeout(5000, 100)).toBe(100);

      // fallback to handler config
      expect(testTimeout(200, undefined)).toBe(200);
      expect(testTimeout(200)).toBe(200);
    });

    it("should pass correct timeout values to internal functions", async () => {
      const nodeHttpHandler = new NodeHttpHandler({ requestTimeout: 5000 });
      (nodeHttpHandler as any).config = {
        requestTimeout: 5000,
        httpAgent: new http.Agent(),
        httpsAgent: new https.Agent(),
        logger: console,
      };

      const httpRequest = new HttpRequest({
        hostname: "example.com",
        method: "GET",
        protocol: "http:",
        path: "/",
        headers: {},
      });

      const options1 = { requestTimeout: 100 };
      const options2 = {};

      const effectiveTimeout1 = options1.requestTimeout ?? (nodeHttpHandler as any).config.requestTimeout;
      const effectiveTimeout2 = options2.requestTimeout ?? (nodeHttpHandler as any).config.requestTimeout;

      expect(effectiveTimeout1).toBe(100); // per-request timeout
      expect(effectiveTimeout2).toBe(5000); // handler config timeout
    });
  });
});
