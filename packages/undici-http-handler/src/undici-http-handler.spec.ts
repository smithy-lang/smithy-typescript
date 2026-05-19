import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { HttpRequest } from "@smithy/core/protocols";
import { Agent, type Dispatcher } from "undici";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UndiciHttpHandler } from "./undici-http-handler";

let server: Server;
let port: number;

function createMockRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return Object.assign(
    new HttpRequest({
      protocol: "http:",
      hostname: "127.0.0.1",
      port,
      method: "GET",
      path: "/",
      headers: {},
    }),
    overrides
  );
}

function createMockLogger() {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, `http://localhost`);

    if (url.pathname === "/delay") {
      const parsedMs = parseInt(url.searchParams.get("ms") ?? "1000", 10);
      const ms = Number.isFinite(parsedMs) ? Math.min(Math.max(parsedMs, 0), 5000) : 1000;
      setTimeout(() => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("delayed");
      }, ms);
      return;
    }

    if (url.pathname === "/echo") {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        res.writeHead(200, {
          "content-type": "application/octet-stream",
          "x-method": req.method!,
          "x-url": req.url!,
        });
        res.end(Buffer.concat(chunks));
      });
      return;
    }

    if (url.pathname === "/multi-header") {
      // Manually write raw response with duplicate headers
      res.writeHead(200, [
        ["set-cookie", "a=1"],
        ["set-cookie", "b=2"],
      ]);
      res.end("ok");
      return;
    }

    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("UndiciHttpHandler", () => {
  let handler: UndiciHttpHandler;

  afterEach(() => {
    handler?.destroy();
  });

  describe("handle", () => {
    it("makes a basic GET request", async () => {
      handler = new UndiciHttpHandler();
      const { response } = await handler.handle(createMockRequest());
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/plain");
    });

    it("sends request body on POST", async () => {
      handler = new UndiciHttpHandler();
      const body = "hello world";
      const { response } = await handler.handle(
        createMockRequest({
          method: "POST",
          path: "/echo",
          body,
          headers: { "content-type": "text/plain" },
        })
      );
      expect(response.statusCode).toBe(200);
      expect(response.headers["x-method"]).toBe("POST");
      const text = await new Response(response.body).text();
      expect(text).toBe("hello world");
    });

    it("sends Buffer body", async () => {
      handler = new UndiciHttpHandler();
      const body = Buffer.from("buffer body");
      const { response } = await handler.handle(
        createMockRequest({
          method: "POST",
          path: "/echo",
          headers: { "content-type": "application/octet-stream" },
          body,
        })
      );
      expect(response.statusCode).toBe(200);
      const text = await new Response(response.body).text();
      expect(text).toBe("buffer body");
    });

    it("appends query string to path", async () => {
      handler = new UndiciHttpHandler();
      const { response } = await handler.handle(
        createMockRequest({
          path: "/echo",
          query: { foo: "bar", baz: "qux" },
        })
      );
      expect(response.statusCode).toBe(200);
      expect(response.headers["x-url"]).toContain("foo=bar");
      expect(response.headers["x-url"]).toContain("baz=qux");
    });

    it("joins multi-value response headers with comma", async () => {
      handler = new UndiciHttpHandler();
      const { response } = await handler.handle(createMockRequest({ path: "/multi-header" }));
      expect(response.statusCode).toBe(200);
      expect(response.headers["set-cookie"]).toBe("a=1, b=2");
    });

    it("handles fragment in path", async () => {
      handler = new UndiciHttpHandler();
      const { response } = await handler.handle(
        createMockRequest({
          path: "/echo",
          fragment: "section1",
        } as any)
      );
      expect(response.statusCode).toBe(200);
    });
  });

  describe("abort signal", () => {
    it("throws AbortError if signal is already aborted", async () => {
      handler = new UndiciHttpHandler();
      const controller = new AbortController();
      controller.abort();
      await expect(
        handler.handle(createMockRequest(), {
          abortSignal: controller.signal as any,
        })
      ).rejects.toThrow("Request aborted");
    });

    it("throws error with name AbortError if signal is already aborted", async () => {
      handler = new UndiciHttpHandler();
      const controller = new AbortController();
      controller.abort();
      try {
        await handler.handle(createMockRequest(), {
          abortSignal: controller.signal as any,
        });
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.name).toBe("AbortError");
      }
    });

    it("throws AbortError when signal is aborted during request", async () => {
      handler = new UndiciHttpHandler();
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10);
      await expect(
        handler.handle(createMockRequest({ path: "/delay?ms=5000" }), {
          abortSignal: controller.signal as any,
        })
      ).rejects.toThrow();
    });

    it("sets name to AbortError on UND_ERR_ABORTED and preserves original error", async () => {
      const abortError = Object.assign(new Error("aborted"), {
        code: "UND_ERR_ABORTED",
      });
      const mockDispatcher = {
        request: vi.fn().mockRejectedValue(abortError),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      try {
        await handler.handle(createMockRequest());
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.name).toBe("AbortError");
        expect(err.code).toBe("UND_ERR_ABORTED");
        expect(err).toBe(abortError);
      }
    });
  });

  describe("timeouts", () => {
    it("uses requestTimeout from handle options", async () => {
      handler = new UndiciHttpHandler();
      await expect(
        handler.handle(createMockRequest({ path: "/delay?ms=5000" }), {
          requestTimeout: 50,
        })
      ).rejects.toThrow();
    });

    it("sets name to TimeoutError on UND_ERR_HEADERS_TIMEOUT and preserves original error", async () => {
      const timeoutError = Object.assign(new Error("headers timed out"), {
        code: "UND_ERR_HEADERS_TIMEOUT",
      });
      const mockDispatcher = {
        request: vi.fn().mockRejectedValue(timeoutError),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      try {
        await handler.handle(createMockRequest());
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.name).toBe("TimeoutError");
        expect(err.code).toBe("UND_ERR_HEADERS_TIMEOUT");
        expect(err).toBe(timeoutError);
      }
    });

    it("sets name to TimeoutError on UND_ERR_BODY_TIMEOUT and preserves original error", async () => {
      const timeoutError = Object.assign(new Error("body timed out"), {
        code: "UND_ERR_BODY_TIMEOUT",
      });
      const mockDispatcher = {
        request: vi.fn().mockRejectedValue(timeoutError),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      try {
        await handler.handle(createMockRequest());
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.name).toBe("TimeoutError");
        expect(err.code).toBe("UND_ERR_BODY_TIMEOUT");
        expect(err).toBe(timeoutError);
      }
    });

    it("sets name to TimeoutError on UND_ERR_CONNECT_TIMEOUT and preserves original error", async () => {
      const timeoutError = Object.assign(new Error("connect timed out"), {
        code: "UND_ERR_CONNECT_TIMEOUT",
      });
      const mockDispatcher = {
        request: vi.fn().mockRejectedValue(timeoutError),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      try {
        await handler.handle(createMockRequest());
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.name).toBe("TimeoutError");
        expect(err.code).toBe("UND_ERR_CONNECT_TIMEOUT");
        expect(err).toBe(timeoutError);
      }
    });
  });

  describe("socket errors", () => {
    it("sets name to RequestTimeout on UND_ERR_SOCKET and preserves original error", async () => {
      const socketError = Object.assign(new Error("socket error"), {
        code: "UND_ERR_SOCKET",
      });
      const mockDispatcher = {
        request: vi.fn().mockRejectedValue(socketError),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      try {
        await handler.handle(createMockRequest());
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.name).toBe("RequestTimeout");
        expect(err.code).toBe("UND_ERR_SOCKET");
        expect(err).toBe(socketError);
      }
    });
  });

  describe("unknown errors", () => {
    it("rethrows unknown errors unmodified", async () => {
      const unknownError = new Error("something unexpected");
      const mockDispatcher = {
        request: vi.fn().mockRejectedValue(unknownError),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      try {
        await handler.handle(createMockRequest());
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err).toBe(unknownError);
        expect(err.message).toBe("something unexpected");
      }
    });
  });

  describe("external dispatcher", () => {
    it("uses provided dispatcher", async () => {
      const mockDispatcher = {
        request: vi.fn().mockResolvedValue({
          statusCode: 201,
          headers: { "x-custom": "value" },
          body: null,
        }),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      const { response } = await handler.handle(createMockRequest());
      expect(response.statusCode).toBe(201);
      expect(response.headers["x-custom"]).toBe("value");
      expect(mockDispatcher.request).toHaveBeenCalledOnce();
    });

    it("destroys external dispatcher on handler destroy", () => {
      const mockDispatcher = {
        request: vi.fn(),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      handler.destroy();
      expect(mockDispatcher.destroy).toHaveBeenCalled();
    });
  });

  describe("event stream (isEventStream)", () => {
    it("makes a successful request with an isolated client", async () => {
      handler = new UndiciHttpHandler();
      const { response } = await handler.handle(createMockRequest(), { isEventStream: true });
      expect(response.statusCode).toBe(200);
    });

    it("does not use the shared dispatcher for event stream requests", async () => {
      const mockDispatcher = {
        request: vi.fn().mockResolvedValue({
          statusCode: 200,
          headers: {},
          body: null,
        }),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      const { response } = await handler.handle(createMockRequest(), { isEventStream: true });
      expect(response.statusCode).toBe(200);
      // The shared dispatcher should NOT have been called — an isolated client is used instead.
      expect(mockDispatcher.request).not.toHaveBeenCalled();
    });

    it("uses the shared dispatcher when isEventStream is false", async () => {
      const mockDispatcher = {
        request: vi.fn().mockResolvedValue({
          statusCode: 200,
          headers: {},
          body: null,
        }),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      await handler.handle(createMockRequest(), { isEventStream: false });
      expect(mockDispatcher.request).toHaveBeenCalledOnce();
    });

    it("destroys isolated client when abort signal is already aborted", async () => {
      handler = new UndiciHttpHandler();
      const controller = new AbortController();
      controller.abort();
      await expect(
        handler.handle(createMockRequest(), {
          abortSignal: controller.signal as any,
          isEventStream: true,
        })
      ).rejects.toThrow("Request aborted");
    });

    it("destroys isolated client on request error", async () => {
      handler = new UndiciHttpHandler();
      // Use a port that nothing is listening on to trigger a connection error.
      const badRequest = Object.assign(
        new HttpRequest({
          protocol: "http:",
          hostname: "127.0.0.1",
          port: 1,
          method: "GET",
          path: "/",
          headers: {},
        })
      );
      await expect(handler.handle(badRequest, { isEventStream: true })).rejects.toThrow();
    });

    it("appends query string to path with isolated client", async () => {
      handler = new UndiciHttpHandler();
      const { response } = await handler.handle(
        createMockRequest({
          path: "/echo",
          query: { foo: "bar" },
        }),
        { isEventStream: true }
      );
      expect(response.statusCode).toBe(200);
      expect(response.headers["x-url"]).toContain("foo=bar");
    });
  });

  describe("expect header", () => {
    it.each(["expect", "Expect"])("strips '%s' header before sending to undici", async (expectHeader) => {
      const mockDispatcher = {
        request: vi.fn().mockResolvedValue({
          statusCode: 200,
          headers: {},
          body: null,
        }),
        destroy: vi.fn(),
      } as unknown as Dispatcher;

      handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
      await handler.handle(
        createMockRequest({
          method: "PUT",
          headers: {
            "content-type": "application/octet-stream",
            [expectHeader]: "100-continue",
          },
        })
      );

      const callArgs = (mockDispatcher.request as any).mock.calls[0][0];
      expect(callArgs.headers).not.toHaveProperty(expectHeader);
    });
  });

  describe("transfer-encoding header", () => {
    it.each(["transfer-encoding", "Transfer-Encoding"])(
      "strips '%s' header when body is a stream",
      async (transferEncodingHeader) => {
        const mockDispatcher = {
          request: vi.fn().mockResolvedValue({
            statusCode: 200,
            headers: {},
            body: null,
          }),
          destroy: vi.fn(),
        } as unknown as Dispatcher;

        // Duck-type a stream-like body (has pipe and on methods)
        const streamBody = {
          pipe: vi.fn(),
          on: vi.fn(),
        };

        handler = new UndiciHttpHandler({ dispatcher: mockDispatcher });
        await handler.handle(
          createMockRequest({
            method: "PUT",
            headers: {
              "content-type": "application/octet-stream",
              [transferEncodingHeader]: "chunked",
            },
            body: streamBody as any,
          })
        );

        const callArgs = (mockDispatcher.request as any).mock.calls[0][0];
        expect(callArgs.headers).not.toHaveProperty(transferEncodingHeader);
      }
    );
  });

  describe("destroy", () => {
    it("destroys internal dispatcher", async () => {
      handler = new UndiciHttpHandler();
      // Trigger dispatcher creation
      await handler.handle(createMockRequest());
      // Should not throw
      handler.destroy();
    });

    it("is safe to call multiple times", () => {
      handler = new UndiciHttpHandler();
      handler.destroy();
      handler.destroy();
    });
  });

  describe("updateHttpClientConfig / httpHandlerConfigs", () => {
    it("returns config before first request", () => {
      const logger = createMockLogger();
      handler = new UndiciHttpHandler({ logger });
      expect(handler.httpHandlerConfigs()).toEqual({ logger });
    });

    it("returns config after first request", async () => {
      const logger = createMockLogger();
      handler = new UndiciHttpHandler({ logger });
      await handler.handle(createMockRequest());
      const configs = handler.httpHandlerConfigs();
      expect(configs.logger).toBe(logger);
    });

    it("updates config", async () => {
      const logger = createMockLogger();
      const updatedLogger = createMockLogger();
      handler = new UndiciHttpHandler({ logger });
      await handler.handle(createMockRequest());
      handler.updateHttpClientConfig("logger", updatedLogger);
      // Config is reset, need another request to resolve
      await handler.handle(createMockRequest());
      expect(handler.httpHandlerConfigs().logger).toBe(updatedLogger);
    });

    it("retains existing dispatcher if undefined is passed", () => {
      handler = new UndiciHttpHandler();
      const configBefore = handler.httpHandlerConfigs();
      handler.updateHttpClientConfig("dispatcher", undefined as any);
      const configAfter = handler.httpHandlerConfigs();
      expect(configAfter.dispatcher).toBe(configBefore.dispatcher);
    });

    it("accepts Agent.Options and creates an Agent internally", async () => {
      handler = new UndiciHttpHandler();
      handler.updateHttpClientConfig("dispatcher", { connections: 2 } as any);

      const { response } = await handler.handle(createMockRequest());
      expect(response.statusCode).toBe(200);
    });

    it("does not destroy previous dispatcher when validation fails", async () => {
      handler = new UndiciHttpHandler();
      // Trigger internal dispatcher creation
      await handler.handle(createMockRequest());

      expect(() => handler.updateHttpClientConfig("dispatcher", "invalid" as any)).toThrow(
        "must be an instance of undici Dispatcher or Agent.Options"
      );

      // Handler should still work with its internal dispatcher
      const { response } = await handler.handle(createMockRequest());
      expect(response.statusCode).toBe(200);
    });

    it("closes previous internal dispatcher when updating with a new Dispatcher", async () => {
      handler = new UndiciHttpHandler();
      // Trigger internal dispatcher creation
      await handler.handle(createMockRequest());

      // Capture the internal dispatcher and spy on its close method
      const previousDispatcher = handler.httpHandlerConfigs().dispatcher!;
      const closeSpy = vi.spyOn(previousDispatcher, "close");

      const newDispatcher = new Agent();

      handler.updateHttpClientConfig("dispatcher", newDispatcher);

      // Assert the previous internal dispatcher's close was called (fire-and-forget)
      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();

      // The new dispatcher should be used for subsequent requests
      const { response } = await handler.handle(createMockRequest());
      expect(response.statusCode).toBe(200);

      newDispatcher.destroy();
    });

    it("closes previous external dispatcher when updating", async () => {
      const oldDispatcher = new Agent();
      const closeSpy = vi.spyOn(oldDispatcher, "close");

      handler = new UndiciHttpHandler({ dispatcher: oldDispatcher });
      await handler.handle(createMockRequest());

      const newDispatcher = new Agent();

      handler.updateHttpClientConfig("dispatcher", newDispatcher);

      // Old external dispatcher should be closed (fire-and-forget)
      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();

      oldDispatcher.destroy();
      newDispatcher.destroy();
    });

    it("destroys dispatcher on handler destroy even if set via update", async () => {
      const newDispatcher = new Agent();
      const destroySpy = vi.spyOn(newDispatcher, "destroy");

      handler = new UndiciHttpHandler();
      handler.updateHttpClientConfig("dispatcher", newDispatcher);

      handler.destroy();

      expect(destroySpy).toHaveBeenCalled();
      destroySpy.mockRestore();
    });
  });
});
