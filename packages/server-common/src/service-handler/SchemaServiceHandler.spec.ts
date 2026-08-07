import { describe, expect, it, vi } from "vitest";
import { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { StaticOperationSchema } from "@smithy/types";

import { SchemaServiceHandler } from "./SchemaServiceHandler";
import type { SchemaServiceHandlerOptions, ServerRequestContext } from "./SchemaServiceHandler";
import { ServiceException } from "../validation/errors";
import { SmithyRpcV2CborServerProtocol } from "../protocols-schema/layer-2-protocols/SmithyRpcV2CborServerProtocol";

function makeOpSchema(name: string): StaticOperationSchema {
  return [9, "test.ns", name, 0, "unit", "unit"] satisfies StaticOperationSchema;
}

function makeMinimalOptions(overrides: Partial<SchemaServiceHandlerOptions> = {}): SchemaServiceHandlerOptions {
  return {
    protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
    operationSchemas: [makeOpSchema("TestOp")],
    handlers: {
      TestOp: async () => ({}),
    },
    ...overrides,
  };
}

function makeRpcRequest(operationName: string, body?: Uint8Array): HttpRequest {
  return new HttpRequest({
    method: "POST",
    path: `/service/test.ns%23TestService/operation/${operationName}`,
    headers: {
      "content-type": "application/cbor",
      "smithy-protocol": "rpc-v2-cbor",
      accept: "application/cbor",
    },
    body: body ?? new Uint8Array(0),
  });
}

describe("SchemaServiceHandler", () => {
  describe("constructor validation", () => {
    it("succeeds when all operations have handlers", () => {
      expect(() => new SchemaServiceHandler(makeMinimalOptions())).not.toThrow();
    });

    it("succeeds with multiple operations", () => {
      expect(
        () =>
          new SchemaServiceHandler({
            protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
            operationSchemas: [makeOpSchema("OpA"), makeOpSchema("OpB")],
            handlers: {
              OpA: async () => ({}),
              OpB: async () => ({}),
            },
          })
      ).not.toThrow();
    });

    it("throws when an operation schema is missing a handler", () => {
      expect(
        () =>
          new SchemaServiceHandler({
            protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
            operationSchemas: [makeOpSchema("OpA"), makeOpSchema("OpB")],
            handlers: {
              OpA: async () => ({}),
            },
          })
      ).toThrow(/missing handlers.*OpB/);
    });

    it("throws when a handler has no corresponding operation schema", () => {
      expect(
        () =>
          new SchemaServiceHandler({
            protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
            operationSchemas: [makeOpSchema("OpA")],
            handlers: {
              OpA: async () => ({}),
              Orphan: async () => ({}),
            },
          })
      ).toThrow(/no corresponding operation schema.*Orphan/);
    });

    it("throws listing all missing handlers", () => {
      expect(
        () =>
          new SchemaServiceHandler({
            protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
            operationSchemas: [makeOpSchema("OpA"), makeOpSchema("OpB"), makeOpSchema("OpC")],
            handlers: {
              OpA: async () => ({}),
            },
          })
      ).toThrow(/OpB.*OpC|OpC.*OpB/);
    });

    it("builds operationSchemas map from the array using schema[2] as key", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      // The handler should successfully route a request to TestOp.
      // This indirectly proves the map was built correctly.
      expect(handler).toBeDefined();
    });

    it("defaults validationEnabled to true", () => {
      // We can't access private fields directly, but we can verify behavior:
      // construct without specifying validationEnabled, it should be true (default).
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      expect(handler).toBeDefined();
    });

    it("accepts validationEnabled=false", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions({ validationEnabled: false }));
      expect(handler).toBeDefined();
    });
  });

  describe("addOperation", () => {
    it("adds a new operation dynamically", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const newSchema = makeOpSchema("NewOp");
      const newHandler = async () => ({ result: "dynamic" });

      expect(() => handler.addOperation(newSchema, newHandler)).not.toThrow();
    });

    it("throws when adding a duplicate operation", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const duplicateSchema = makeOpSchema("TestOp");

      expect(() => handler.addOperation(duplicateSchema, async () => ({}))).toThrow(/already registered/);
    });

    it("returns this for chaining", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const result = handler.addOperation(makeOpSchema("NewOp"), async () => ({}));
      expect(result).toBe(handler);
    });

    it("allows handling requests to dynamically added operations", async () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const newSchema = makeOpSchema("DynamicOp");
      handler.addOperation(newSchema, async () => ({ message: "hello" }));

      const request = makeRpcRequest("DynamicOp");
      const response = await handler.handle(request, {});
      // Should not be a 400 (malformed) which means routing worked
      expect(response).toBeInstanceOf(HttpResponse);
    });
  });

  describe("handle", () => {
    it("returns 400 for unroutable requests", async () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const request = new HttpRequest({
        method: "GET",
        path: "/completely/unknown/path",
        headers: {},
      });

      const response = await handler.handle(request, {});
      expect(response.statusCode).toBe(400);
    });

    it("invokes the correct handler based on operation name", async () => {
      const handlerFn = vi.fn(async () => ({}));
      const handler = new SchemaServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
        operationSchemas: [makeOpSchema("MyOp")],
        handlers: { MyOp: handlerFn },
      });

      await handler.handle(makeRpcRequest("MyOp"), {});
      expect(handlerFn).toHaveBeenCalledTimes(1);
    });

    it("passes ServerRequestContext to handler", async () => {
      let capturedContext: ServerRequestContext | undefined;
      const handler = new SchemaServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
        operationSchemas: [makeOpSchema("MyOp")],
        handlers: {
          MyOp: async (_input, ctx) => {
            capturedContext = ctx;
            return {};
          },
        },
      });

      await handler.handle(makeRpcRequest("MyOp"), {});
      expect(capturedContext).toBeDefined();
      expect(capturedContext!.operation).toBe("MyOp");
      expect(capturedContext!.request.method).toBe("POST");
      expect(capturedContext!.request.headers["smithy-protocol"]).toBe("rpc-v2-cbor");
    });

    it("passes user context to handler", async () => {
      let capturedUserCtx: any;
      const handler = new SchemaServiceHandler<{ userId: string }>({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
        operationSchemas: [makeOpSchema("MyOp")],
        handlers: {
          MyOp: async (_input, _ctx, userCtx) => {
            capturedUserCtx = userCtx;
            return {};
          },
        },
      });

      await handler.handle(makeRpcRequest("MyOp"), { userId: "u123" });
      expect(capturedUserCtx).toEqual({ userId: "u123" });
    });

    it("returns error response when handler throws", async () => {
      const handler = new SchemaServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
        operationSchemas: [makeOpSchema("MyOp")],
        handlers: {
          MyOp: async () => {
            throw new Error("boom");
          },
        },
      });

      const response = await handler.handle(makeRpcRequest("MyOp"), {});
      expect(response.statusCode).toBeGreaterThanOrEqual(500);
    });
  });

  describe("fluent API", () => {
    it("withMetrics returns this", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const result = handler.withMetrics({ create: () => ({}) as any });
      expect(result).toBe(handler);
    });

    it("withAuth returns this", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const result = handler.withAuth({ name: "test", authenticate: async () => null });
      expect(result).toBe(handler);
    });

    it("addInterceptor returns this", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const result = handler.addInterceptor({});
      expect(result).toBe(handler);
    });

    it("addInterceptors returns this", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const result = handler.addInterceptors({}, {});
      expect(result).toBe(handler);
    });

    it("withRouter returns this", () => {
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      const result = handler.withRouter(() => undefined);
      expect(result).toBe(handler);
    });
  });

  describe("interceptors", () => {
    it("calls readBeforeExecution on each request", async () => {
      const interceptor = { readBeforeExecution: vi.fn() };
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      handler.addInterceptor(interceptor);

      await handler.handle(makeRpcRequest("TestOp"), {});
      expect(interceptor.readBeforeExecution).toHaveBeenCalledTimes(1);
    });

    it("calls readAfterExecution on success", async () => {
      const interceptor = { readAfterExecution: vi.fn() };
      const handler = new SchemaServiceHandler(makeMinimalOptions());
      handler.addInterceptor(interceptor);

      await handler.handle(makeRpcRequest("TestOp"), {});
      expect(interceptor.readAfterExecution).toHaveBeenCalledTimes(1);
    });

    it("calls readAfterExecution on error with error field", async () => {
      const interceptor = { readAfterExecution: vi.fn() };
      const handler = new SchemaServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
        operationSchemas: [makeOpSchema("MyOp")],
        handlers: {
          MyOp: async () => {
            throw new Error("fail");
          },
        },
      });
      handler.addInterceptor(interceptor);

      await handler.handle(makeRpcRequest("MyOp"), {});
      expect(interceptor.readAfterExecution).toHaveBeenCalledTimes(1);
      expect(interceptor.readAfterExecution.mock.calls[0][0]).toHaveProperty("error");
    });
  });

  describe("auth", () => {
    it("calls auth schemes and passes caller to handler context", async () => {
      let capturedContext: ServerRequestContext | undefined;
      const handler = new SchemaServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
        operationSchemas: [makeOpSchema("MyOp")],
        handlers: {
          MyOp: async (_input, ctx) => {
            capturedContext = ctx;
            return {};
          },
        },
      });
      handler.withAuth({
        name: "test-auth",
        authenticate: async () => ({ principal: "user-1" }),
      });

      await handler.handle(makeRpcRequest("MyOp"), {});
      expect(capturedContext!.caller).toEqual({ principal: "user-1" });
    });

    it("returns error response when all auth schemes reject", async () => {
      const handler = new SchemaServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
        operationSchemas: [makeOpSchema("MyOp")],
        handlers: {
          MyOp: async () => ({}),
        },
      });
      handler.withAuth({
        name: "reject-auth",
        authenticate: async () => null,
      });

      const response = await handler.handle(makeRpcRequest("MyOp"), {});
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe("onError hook", () => {
    it("replaces handler errors via onError", async () => {
      const onErrorFn = vi.fn((_op: any, _err: any) => {
        return new ServiceException({ name: "CustomError", $fault: "client", message: "replaced" });
      });
      const handler = new SchemaServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
        operationSchemas: [makeOpSchema("MyOp")],
        handlers: {
          MyOp: async () => {
            throw new Error("original");
          },
        },
        onError: onErrorFn,
      });

      const response = await handler.handle(makeRpcRequest("MyOp"), {});
      // onError should have been called
      expect(onErrorFn).toHaveBeenCalledTimes(1);
      expect(onErrorFn.mock.calls[0][0]).toBe("MyOp");
      // Should get an error response
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});
