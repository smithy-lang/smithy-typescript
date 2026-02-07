import { HttpRequest } from "@smithy/protocol-http";
import http, { request as hRequest } from "node:http";
import https, { request as hsRequest } from "node:https";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { NodeHttpHandler } from "./node-http-handler";
import * as setConnectionTimeoutModule from "./set-connection-timeout";
import * as setRequestTimeoutModule from "./set-request-timeout";
import * as setSocketTimeoutModule from "./set-socket-timeout";
import { timing } from "./timing";

vi.mock("node:http", async () => {
  const actual = (await vi.importActual("node:http")) as any;
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

vi.mock("node:https", async () => {
  const actual = (await vi.importActual("node:https")) as any;
  const http = (await vi.importActual("node:http")) as any;
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

describe("NodeHttpHandler", () => {
  describe("constructor and #handle", () => {
    const randomMaxSocket = Math.round(Math.random() * 50) + 1;
    const randomSocketAcquisitionWarningTimeout = Math.round(Math.random() * 10000) + 1;
    const randomConnectionTimeout = Math.round(Math.random() * 10000) + 1;
    const randomSocketTimeout = Math.round(Math.random() * 10000) + 1;
    const randomRequestTimeout = Math.round(Math.random() * 10000) + 1;

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
        ["an options hash", { connectionTimeout: randomConnectionTimeout }],
        [
          "a provider",
          async () => ({
            connectionTimeout: randomConnectionTimeout,
          }),
        ],
      ])("sets connectionTimeout correctly when input is %s", async (_, option) => {
        vi.spyOn(setConnectionTimeoutModule, "setConnectionTimeout");
        const nodeHttpHandler = new NodeHttpHandler(option);
        await nodeHttpHandler.handle({} as any);
        expect(vi.mocked(setConnectionTimeoutModule.setConnectionTimeout).mock.calls[0][2]).toBe(
          randomConnectionTimeout
        );
      });

      it.each([
        ["an options hash", { requestTimeout: randomRequestTimeout }],
        [
          "a provider",
          async () => ({
            requestTimeout: randomRequestTimeout,
          }),
        ],
      ])("sets requestTimeout correctly when input is %s", async (_, option) => {
        vi.spyOn(setRequestTimeoutModule, "setRequestTimeout");
        const nodeHttpHandler = new NodeHttpHandler(option);
        await nodeHttpHandler.handle({} as any);
        expect(vi.mocked(setRequestTimeoutModule.setRequestTimeout).mock.calls[0][2]).toBe(randomRequestTimeout);
      });

      it.each([
        ["an options hash", { socketTimeout: randomSocketTimeout }],
        [
          "a provider",
          async () => ({
            socketTimeout: randomSocketTimeout,
          }),
        ],
      ])("sets socketTimeout correctly when input is %s", async (_, option) => {
        vi.spyOn(setSocketTimeoutModule, "setSocketTimeout");
        const nodeHttpHandler = new NodeHttpHandler(option);
        await nodeHttpHandler.handle({} as any);
        expect(vi.mocked(setSocketTimeoutModule.setSocketTimeout).mock.calls[0][2]).toBe(randomSocketTimeout);
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
          Array.from({ length: 10 }).map(() =>
            nodeHttpHandler.handle({
              protocol: "https:",
              hostname: "localhost",
              port: 54321,
              path: "/",
            } as unknown as HttpRequest)
          )
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

      describe("per-request requestTimeout", () => {
        it("should use per-request timeout over handler config timeout", async () => {
          const testTimeout = async (handlerTimeout: number, requestTimeout?: number) => {
            const handler = new NodeHttpHandler({ requestTimeout: handlerTimeout });
            await handler.handle(
              new HttpRequest({
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
              }),
              {
                requestTimeout,
              }
            );
            expect(timing.setTimeout).toHaveBeenCalledWith(expect.any(Function), requestTimeout ?? handlerTimeout);
          };

          await testTimeout(5123.1, 125.1);
          await testTimeout(264.1, undefined);
          await testTimeout(234.1);
          expect.assertions(3);
        });
      });

      describe("expect 100-continue", () => {
        it("creates a new http(s) Agent if the request has expect: 100-continue header and agents are NodeHttpHandler-owned", async () => {
          const nodeHttpHandler = new NodeHttpHandler({
            httpAgent: {
              maxSockets: 25,
            },
            httpsAgent: {
              maxSockets: 25,
            },
          });
          {
            const httpRequest = {
              protocol: "http:",
              hostname: "[host]",
              path: "/some/path",
              headers: {
                expect: "100-continue",
              },
            };
            await nodeHttpHandler.handle(httpRequest as any);
            expect(vi.mocked(hRequest as any).mock.calls[0][0]?.agent).not.toBe(
              (nodeHttpHandler as any).config.httpAgent
            );
          }
          {
            const httpRequest = {
              protocol: "http:",
              hostname: "[host]",
              path: "/some/path",
              headers: {},
            };
            await nodeHttpHandler.handle(httpRequest as any);
            expect(vi.mocked(hRequest as any).mock.calls[1][0]?.agent).toBe((nodeHttpHandler as any).config.httpAgent);
          }
        });

        it("does not create a new Agent if configured Agent is caller-owned (e.g. proxy), but instead skips the writeBody delay", async () => {
          const nodeHttpHandler = new NodeHttpHandler({
            httpAgent: new http.Agent(),
          });
          {
            const httpRequest = {
              protocol: "http:",
              hostname: "[host]",
              path: "/some/path",
              headers: {
                expect: "100-continue",
              },
            };
            await nodeHttpHandler.handle(httpRequest as any);
            expect(vi.mocked(hRequest as any).mock.calls[0][0]?.agent).toBe((nodeHttpHandler as any).config.httpAgent);
          }
          {
            const httpRequest = {
              protocol: "http:",
              hostname: "[host]",
              path: "/some/path",
              headers: {},
            };
            await nodeHttpHandler.handle(httpRequest as any);
            expect(vi.mocked(hRequest as any).mock.calls[1][0]?.agent).toBe((nodeHttpHandler as any).config.httpAgent);
          }
        });
      });
    });
  });

  describe("create", () => {
    const randomRequestTimeout = Math.round(Math.random() * 10000) + 1;

    it.each([
      ["existing handler instance", new NodeHttpHandler()],
      [
        "custom HttpHandler object",
        {
          handle: vi.fn(),
        } as any,
      ],
    ])("returns the input handler when passed %s", (_, handler) => {
      const result = NodeHttpHandler.create(handler);
      expect(result).toBe(handler);
    });

    it.each([
      ["undefined", undefined],
      ["an empty options hash", {}],
      ["empty provider", async () => undefined],
    ])("creates new handler instance when input is %s", async (_, input) => {
      const result = NodeHttpHandler.create(input);
      expect(result).toBeInstanceOf(NodeHttpHandler);
    });

    it.each([
      ["an options hash", { requestTimeout: randomRequestTimeout }],
      ["a provider", async () => ({ requestTimeout: randomRequestTimeout })],
    ])("creates new handler instance with config when input is %s", async (_, input) => {
      const result = NodeHttpHandler.create(input);
      expect(result).toBeInstanceOf(NodeHttpHandler);

      // Verify configuration by calling handle
      await result.handle({} as any);

      expect(result.httpHandlerConfigs().requestTimeout).toBe(randomRequestTimeout);
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
});
