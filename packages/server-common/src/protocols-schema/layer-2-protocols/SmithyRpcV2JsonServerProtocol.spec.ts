import { beforeEach, describe, expect, it } from "vitest";
import { TypeRegistry } from "@smithy/core/schema";

import { SmithyRpcV2JsonServerProtocol } from "./SmithyRpcV2JsonServerProtocol";
import { SerializationException, UnsupportedMediaTypeException } from "../../validation/errors";
import type {
  BigIntegerSchema,
  HttpRequest as IHttpRequest,
  StaticErrorSchema,
  StaticOperationSchema,
  StringSchema,
} from "@smithy/types";

function makeRequest(headers: Record<string, string> = {}, body?: any): IHttpRequest {
  return {
    method: "POST",
    path: "/service/MyService/operation/MyOp",
    headers,
    query: {},
    body,
  } as any;
}

function makeContext(): any {
  return {
    streamCollector: async (stream: any) => {
      if (stream instanceof Uint8Array) return stream;
      return new Uint8Array(0);
    },
  };
}

function makeUnitOpSchema(): StaticOperationSchema {
  return [9, "test", "MyOp", 0, "unit", "unit"] satisfies StaticOperationSchema;
}

describe("SmithyRpcV2JsonServerProtocol", () => {
  let protocol: SmithyRpcV2JsonServerProtocol;

  beforeEach(() => {
    protocol = new SmithyRpcV2JsonServerProtocol({ defaultNamespace: "test" });
  });

  describe("protocol identification", () => {
    it("returns correct shape ID", () => {
      expect(protocol.getShapeId()).toBe("smithy.protocols#rpcv2Json");
    });
  });

  describe("request validation - Smithy-Protocol header", () => {
    it("rejects requests without Smithy-Protocol header", async () => {
      const request = makeRequest({ "content-type": "application/json" });
      await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).rejects.toBeInstanceOf(
        SerializationException
      );
    });

    it("rejects requests with wrong Smithy-Protocol value", async () => {
      const request = makeRequest({
        "content-type": "application/json",
        "smithy-protocol": "rpc-v2-cbor",
      });
      await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).rejects.toBeInstanceOf(
        SerializationException
      );
    });

    it("accepts requests with correct Smithy-Protocol header", async () => {
      const request = makeRequest({ "smithy-protocol": "rpc-v2-json" });
      const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
      expect(result).toEqual({});
    });

    it("accepts Smithy-Protocol header case-insensitively in header name", async () => {
      const request = makeRequest({ "Smithy-Protocol": "rpc-v2-json" });
      const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
      expect(result).toEqual({});
    });

    it("rejects Smithy-Protocol value with wrong casing (value is case-sensitive)", async () => {
      const request = makeRequest({ "smithy-protocol": "RPC-V2-JSON" });
      await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).rejects.toBeInstanceOf(
        SerializationException
      );
    });
  });

  describe("request validation - forbidden headers", () => {
    it("rejects requests with X-Amz-Target header", async () => {
      const request = makeRequest({
        "smithy-protocol": "rpc-v2-json",
        "x-amz-target": "MyService.MyOp",
      });
      await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).rejects.toBeInstanceOf(
        SerializationException
      );
    });

    it("rejects requests with X-Amzn-Target header", async () => {
      const request = makeRequest({
        "smithy-protocol": "rpc-v2-json",
        "X-Amzn-Target": "MyService.MyOp",
      });
      await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).rejects.toBeInstanceOf(
        SerializationException
      );
    });

    it("accepts requests without forbidden headers", async () => {
      const request = makeRequest({ "smithy-protocol": "rpc-v2-json" });
      await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).resolves.toEqual({});
    });
  });

  describe("request validation - Content-Type", () => {
    it("rejects wrong content type", async () => {
      const request = makeRequest({
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/cbor",
      });
      await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).rejects.toBeInstanceOf(
        UnsupportedMediaTypeException
      );
    });

    it("allows application/json content type", async () => {
      const request = makeRequest({
        "smithy-protocol": "rpc-v2-json",
        "content-type": "application/json",
      });
      const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
      expect(result).toEqual({});
    });

    it("allows missing content type (unit input = no body per spec)", async () => {
      const request = makeRequest({ "smithy-protocol": "rpc-v2-json" });
      const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
      expect(result).toEqual({});
    });
  });

  describe("response serialization - smithy-protocol header", () => {
    it("adds smithy-protocol header to framework exception responses", async () => {
      const frameworkError = {
        name: "SerializationException",
        statusCode: 400,
        $frameworkError: true,
      };
      const opSchema = makeUnitOpSchema();
      const response = await protocol.serializeResponse(opSchema, makeContext(), frameworkError as any);
      expect(response.headers["smithy-protocol"]).toBe("rpc-v2-json");
      expect(response.statusCode).toBe(400);
    });

    it("adds smithy-protocol header and content-type to framework exception", async () => {
      const frameworkError = {
        name: "UnsupportedMediaTypeException",
        statusCode: 415,
        $frameworkError: true,
      };
      const response = await protocol.serializeResponse(makeUnitOpSchema(), makeContext(), frameworkError as any);
      expect(response.headers["smithy-protocol"]).toBe("rpc-v2-json");
      expect(response.headers["content-type"]).toBe("application/json");
      expect(response.statusCode).toBe(415);
    });
  });

  describe("deserialization - unit input", () => {
    it("returns empty object for unit schema with no body", async () => {
      const request = makeRequest({ "smithy-protocol": "rpc-v2-json" });
      const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
      expect(result).toEqual({});
    });

    it("returns empty object for unit schema even with body bytes", async () => {
      // Per spec: requests for operations with no defined input MUST NOT contain bodies,
      // but the server should handle it gracefully.
      const request = makeRequest(
        { "smithy-protocol": "rpc-v2-json", "content-type": "application/json" },
        new TextEncoder().encode("{}") // empty JSON object
      );
      const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
      expect(result).toEqual({});
    });
  });

  describe("claim", () => {
    const claimable = (overrides: Partial<IHttpRequest> = {}): IHttpRequest =>
      ({
        method: "POST",
        path: "/service/MyService/operation/MyOp",
        headers: { "smithy-protocol": "rpc-v2-json" },
        query: {},
        body: undefined,
        ...overrides,
      }) as any;

    it("claims a well-formed POST request with the rpc-v2-json header and matching path", () => {
      expect(protocol.claim(claimable())).toBe(true);
    });

    it("does not claim a request with a non-POST method", () => {
      expect(protocol.claim(claimable({ method: "GET" }))).toBe(false);
    });

    it("claims regardless of method casing (post)", () => {
      expect(protocol.claim(claimable({ method: "post" }))).toBe(true);
    });

    it("does not claim a request missing the smithy-protocol header", () => {
      expect(protocol.claim(claimable({ headers: {} }))).toBe(false);
    });

    it("does not claim a request with the wrong smithy-protocol value", () => {
      expect(protocol.claim(claimable({ headers: { "smithy-protocol": "rpc-v2-cbor" } }))).toBe(false);
    });

    it("does not claim a request whose path is not an RPC v2 route", () => {
      expect(protocol.claim(claimable({ path: "/some/other/path" }))).toBe(false);
    });

    it("does not claim a path with trailing segments after the operation", () => {
      // Backward-compat instance (no serviceName) still rejects trailing junk.
      expect(protocol.claim(claimable({ path: "/service/MyService/operation/MyOp/extra" }))).toBe(false);
    });
  });

  describe("claim/route - full route with modeled service name", () => {
    // Constructed WITH serviceName, as generated servers now do.
    const svcProtocol = new SmithyRpcV2JsonServerProtocol({
      defaultNamespace: "org.xyz.v1",
      serviceName: "XYZService",
    });
    const req = (path: string): IHttpRequest =>
      ({
        method: "POST",
        path,
        headers: { "smithy-protocol": "rpc-v2-json" },
        query: {},
        body: undefined,
      }) as any;
    const opSchemas = { MyOp: makeUnitOpSchema() } as Record<string, StaticOperationSchema>;

    it("claims the exact /service/{name}/operation/{op} route", () => {
      expect(svcProtocol.claim(req("/service/XYZService/operation/MyOp"))).toBe(true);
    });

    it("claims a route with an allowed prefix (last four segments used)", () => {
      expect(svcProtocol.claim(req("/v1/service/XYZService/operation/MyOp"))).toBe(true);
    });

    it("accepts the absolute shape id form (namespace.Service)", () => {
      expect(svcProtocol.claim(req("/service/org.xyz.v1.XYZService/operation/MyOp"))).toBe(true);
    });

    it("does not claim a path for a different service name", () => {
      expect(svcProtocol.claim(req("/service/OtherService/operation/MyOp"))).toBe(false);
    });

    it("does not claim a path with trailing segments after the operation", () => {
      expect(svcProtocol.claim(req("/service/XYZService/operation/MyOp/extra"))).toBe(false);
    });

    it("route returns the operation for the matching service", () => {
      expect(svcProtocol.route(req("/service/XYZService/operation/MyOp"), opSchemas)).toBe("MyOp");
    });

    it("route returns undefined for a different service name", () => {
      expect(svcProtocol.route(req("/service/OtherService/operation/MyOp"), opSchemas)).toBeUndefined();
    });

    it("tolerates a trailing slash and a query string", () => {
      expect(svcProtocol.claim(req("/service/XYZService/operation/MyOp/"))).toBe(true);
      expect(svcProtocol.route(req("/service/XYZService/operation/MyOp?x=1"), opSchemas)).toBe("MyOp");
    });

    it("handles a long adversarial path in linear time", () => {
      // Many repetitions of "/service/a/operation/b" followed by a mismatch would
      // cause polynomial backtracking with an end-anchored regex.
      const path = "/service/a/operation/b".repeat(50_000) + "/x";
      const start = performance.now();
      expect(svcProtocol.claim(req(path))).toBe(false);
      expect(performance.now() - start).toBeLessThan(1_000);
    });
  });

  describe("serializeError - modeled error schema", () => {
    const decode = (body: any) => JSON.parse(new TextDecoder().decode(body));

    it("uses the absolute Shape ID from the modeled schema, even in another namespace", async () => {
      // The service's default namespace is "test" (see beforeEach), but the
      // error is modeled in namespace "other". Serializing through the schema
      // must produce __type "other#CrossNsError", NOT "test#CrossNsError".
      const errorSchema = [
        -3,
        "other",
        "CrossNsError",
        0,
        ["message"],
        [0 satisfies StringSchema],
      ] satisfies StaticErrorSchema;

      class CrossNsError extends Error {
        public readonly name = "CrossNsError";
        public readonly $fault = "client" as const;
      }

      const registry = TypeRegistry.for("other");
      registry.registerError(errorSchema, CrossNsError);

      try {
        const error = Object.assign(new CrossNsError(), { message: "boom" });
        const response = await (protocol as any).serializeError(makeUnitOpSchema(), makeContext(), error);
        const body = decode(response.body);
        expect(body.__type).toBe("other#CrossNsError");
        expect(body.message).toBe("boom");
      } finally {
        registry.clear();
        TypeRegistry.registries.delete("other");
      }
    });

    it("serializes a bigInteger member as a JSON string via the schema", async () => {
      // RPCv2 JSON serializes bigInteger as a JSON string (SEP). Without the
      // modeled schema this member would be emitted as a raw number/bigint.
      const errorSchema = [
        -3,
        "other",
        "BigError",
        0,
        ["message", "big"],
        [0 satisfies StringSchema, 17 satisfies BigIntegerSchema],
      ] satisfies StaticErrorSchema;

      class BigError extends Error {
        public readonly name = "BigError";
        public readonly $fault = "client" as const;
        public big?: bigint;
      }

      const registry = TypeRegistry.for("other");
      registry.registerError(errorSchema, BigError);

      try {
        const error = Object.assign(new BigError(), {
          message: "big one",
          big: 1000000000000000000000000000000000000n,
        });
        const response = await (protocol as any).serializeError(makeUnitOpSchema(), makeContext(), error);
        const body = decode(response.body);
        expect(body.__type).toBe("other#BigError");
        expect(body.big).toBe("1000000000000000000000000000000000000");
      } finally {
        registry.clear();
        TypeRegistry.registries.delete("other");
      }
    });

    it("falls back to default-namespace __type for an unmodeled error", async () => {
      const error = Object.assign(new Error("nope"), { name: "UnregisteredError", $fault: "client" as const });
      const response = await (protocol as any).serializeError(makeUnitOpSchema(), makeContext(), error);
      const body = decode(response.body);
      expect(body.__type).toBe("test#UnregisteredError");
      expect(body.message).toBe("nope");
    });

    it("uses the modeled @httpError status when the runtime error carries no status", async () => {
      // The error has no $metadata.httpStatusCode / statusCode, only the modeled
      // httpError trait (429). resolveErrorStatusCode must apply it rather than
      // falling back to the fault default (400).
      const errorSchema = [
        -3,
        "other",
        "ThrottleError",
        { httpError: 429 },
        ["message"],
        [0 satisfies StringSchema],
      ] satisfies StaticErrorSchema;

      class ThrottleError extends Error {
        public readonly name = "ThrottleError";
        public readonly $fault = "client" as const;
      }

      const registry = TypeRegistry.for("other");
      registry.registerError(errorSchema, ThrottleError);

      try {
        const error = Object.assign(new ThrottleError(), { message: "slow down" });
        const response = await (protocol as any).serializeError(makeUnitOpSchema(), makeContext(), error);
        expect(response.statusCode).toBe(429);
        expect(decode(response.body).__type).toBe("other#ThrottleError");
      } finally {
        registry.clear();
        TypeRegistry.registries.delete("other");
      }
    });

    it("resolves the concrete subclass schema, not a registered base exception", async () => {
      // The base is registered FIRST. An isPrototypeOf match would select it for
      // the subclass too; the concrete lookup must pick the subclass's own schema
      // for __type, members, and @httpError.
      const baseSchema = [
        -3,
        "other",
        "BaseServiceError",
        { httpError: 500 },
        ["message"],
        [0 satisfies StringSchema],
      ] satisfies StaticErrorSchema;
      const derivedSchema = [
        -3,
        "other",
        "NotFoundError",
        { httpError: 404 },
        ["message", "resource"],
        [0 satisfies StringSchema, 0 satisfies StringSchema],
      ] satisfies StaticErrorSchema;

      class BaseServiceError extends Error {
        public readonly name: string = "BaseServiceError";
        public readonly $fault = "client" as const;
      }
      class NotFoundError extends BaseServiceError {
        public readonly name: string = "NotFoundError";
        public resource?: string;
      }

      const registry = TypeRegistry.for("other");
      registry.registerError(baseSchema, BaseServiceError);
      registry.registerError(derivedSchema, NotFoundError);

      try {
        const derived = Object.assign(new NotFoundError(), { message: "missing", resource: "widget-1" });
        const derivedResponse = await (protocol as any).serializeError(makeUnitOpSchema(), makeContext(), derived);
        const derivedBody = decode(derivedResponse.body);
        expect(derivedBody.__type).toBe("other#NotFoundError");
        expect(derivedBody.resource).toBe("widget-1");
        expect(derivedResponse.statusCode).toBe(404);

        const base = Object.assign(new BaseServiceError(), { message: "boom" });
        const baseResponse = await (protocol as any).serializeError(makeUnitOpSchema(), makeContext(), base);
        expect(decode(baseResponse.body).__type).toBe("other#BaseServiceError");
        expect(baseResponse.statusCode).toBe(500);
      } finally {
        registry.clear();
        TypeRegistry.registries.delete("other");
      }
    });
  });

  describe("serializeSuccess - unit output", () => {
    it("returns an empty body and no content-type for unit output", async () => {
      // Per the SEP, an operation targeting the Unit output shape MUST NOT have
      // a response body and MUST NOT set Content-Type.
      const response = await (protocol as any).serializeSuccess(makeUnitOpSchema(), makeContext(), {});
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeUndefined();
      expect(response.headers["content-type"]).toBeUndefined();
      expect(response.headers["smithy-protocol"]).toBe("rpc-v2-json");
    });

    it("still serializes a body and content-type for non-unit output", async () => {
      // A struct output must produce a JSON body with the content-type set.
      const structOutputOp = [
        9,
        "test",
        "MyOp",
        0,
        "unit",
        [3, "test", "Out", 0, ["value"], [0 satisfies StringSchema]],
      ] satisfies StaticOperationSchema;
      const response = await (protocol as any).serializeSuccess(structOutputOp, makeContext(), { value: "hello" });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/json");
      expect(response.headers["smithy-protocol"]).toBe("rpc-v2-json");
      expect(JSON.parse(new TextDecoder().decode(response.body))).toEqual({ value: "hello" });
    });
  });
});
