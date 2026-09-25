import { beforeEach, describe, expect, it } from "vitest";
import { SmithyRpcV2JsonServerProtocol } from "./SmithyRpcV2JsonServerProtocol";
import { SerializationException, UnsupportedMediaTypeException } from "../../validation/errors";
import type { HttpRequest as IHttpRequest, StaticOperationSchema } from "@smithy/types";

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
});
