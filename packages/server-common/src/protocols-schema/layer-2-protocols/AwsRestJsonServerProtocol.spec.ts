import { beforeEach, describe, expect, it } from "vitest";
import { AwsRestJsonServerProtocol } from "./AwsRestJsonServerProtocol";
import { ServiceException, NotAcceptableException, UnsupportedMediaTypeException } from "../../validation/errors";
import type { HttpRequest as IHttpRequest, StaticOperationSchema } from "@smithy/types";

function makeRequest(overrides: Partial<IHttpRequest> = {}): IHttpRequest {
  return {
    method: "POST",
    path: "/items",
    headers: {},
    query: {},
    body: undefined,
    ...overrides,
  } as any;
}

function makeContext(): any {
  return {
    streamCollector: async (stream: any) => {
      if (stream instanceof Uint8Array) return stream;
      if (stream === undefined || stream === null) return new Uint8Array(0);
      return new Uint8Array(0);
    },
  };
}

describe("AwsRestJsonServerProtocol", () => {
  let protocol: AwsRestJsonServerProtocol;

  beforeEach(() => {
    protocol = new AwsRestJsonServerProtocol({ defaultNamespace: "com.example" });
    protocol.setSerdeContext(makeContext());
  });

  describe("protocol identification", () => {
    it("returns correct shape ID", () => {
      expect(protocol.getShapeId()).toBe("aws.protocols#restJson1");
    });
  });

  describe("content-type handling", () => {
    it("accepts application/json for document body operations", async () => {
      // Operation with non-bound members (document body).
      const inputSchema: any = [3, "test", "Input", 0, ["name"], [0]];
      const opSchema = [
        9,
        "test",
        "CreateItem",
        { http: ["POST", "/items", 201] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const body = new TextEncoder().encode(JSON.stringify({ name: "test" }));
      const request = makeRequest({
        headers: { "content-type": "application/json" },
        body,
        path: "/items",
      });

      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.name).toBe("test");
    });

    it("rejects wrong content-type for document body operations", async () => {
      const inputSchema: any = [3, "test", "Input", 0, ["name"], [0]];
      const opSchema = [
        9,
        "test",
        "CreateItem",
        { http: ["POST", "/items", 201] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const request = makeRequest({
        headers: { "content-type": "application/xml" },
        body: new Uint8Array(0),
        path: "/items",
      });

      await expect(protocol.deserializeRequest(opSchema, makeContext(), request)).rejects.toBeInstanceOf(
        UnsupportedMediaTypeException
      );
    });

    it("allows any content-type for blob @httpPayload operations", async () => {
      // 21 = BlobSchema sentinel
      const inputSchema: any = [3, "test", "Input", 0, ["image"], [[21, { httpPayload: 1 }]]];
      const opSchema = [
        9,
        "test",
        "PutImage",
        { http: ["PUT", "/image", 200] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const body = new Uint8Array([0xff, 0xd8, 0xff]);
      const request = makeRequest({
        headers: { "content-type": "image/jpeg" },
        body,
        path: "/image",
      });

      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.image).toEqual(body);
    });

    it("allows any content-type for streaming blob @httpPayload operations", async () => {
      // 42 = StreamingBlobSchema sentinel
      const inputSchema: any = [3, "test", "Input", 0, ["body"], [[42, { httpPayload: 1 }]]];
      const opSchema = [
        9,
        "test",
        "StreamUp",
        { http: ["PUT", "/stream", 200] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const fakeStream = Symbol("stream");
      const request = makeRequest({
        headers: { "content-type": "application/octet-stream" },
        body: fakeStream,
        path: "/stream",
      } as any);

      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.body).toBe(fakeStream);
    });

    it("rejects non-matching Accept header for document body operations", async () => {
      const inputSchema: any = [3, "test", "Input", 0, ["name"], [0]];
      const opSchema = [
        9,
        "test",
        "CreateItem",
        { http: ["POST", "/items", 201] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const request = makeRequest({
        headers: { accept: "application/xml" },
        path: "/items",
      });

      await expect(protocol.deserializeRequest(opSchema, makeContext(), request)).rejects.toBeInstanceOf(
        NotAcceptableException
      );
    });

    it("skips Accept validation for blob @httpPayload operations", async () => {
      const inputSchema: any = [3, "test", "Input", 0, ["image"], [[21, { httpPayload: 1 }]]];
      const opSchema = [
        9,
        "test",
        "PutImage",
        { http: ["PUT", "/image", 200] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const body = new Uint8Array([1, 2, 3]);
      const request = makeRequest({
        headers: { accept: "image/png", "content-type": "image/png" },
        body,
        path: "/image",
      });

      // Should not throw — Accept is irrelevant for blob payload operations.
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.image).toEqual(body);
    });
  });

  describe("deserialization - HTTP bindings", () => {
    it("extracts path labels", async () => {
      const inputSchema: any = [3, "test", "Input", 0, ["itemId"], [[0, { httpLabel: 1 }]]];
      const opSchema = [
        9,
        "test",
        "GetItem",
        { http: ["GET", "/items/{itemId}", 200] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const request = makeRequest({ path: "/items/abc-123", method: "GET" });
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.itemId).toBe("abc-123");
    });

    it("extracts query parameters", async () => {
      const inputSchema: any = [3, "test", "Input", 0, ["limit"], [[1, { httpQuery: "limit" }]]];
      const opSchema = [
        9,
        "test",
        "ListItems",
        { http: ["GET", "/items", 200] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const request = makeRequest({ path: "/items", method: "GET", query: { limit: "25" } });
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.limit).toBe(25);
    });

    it("extracts headers", async () => {
      const inputSchema: any = [3, "test", "Input", 0, ["token"], [[0, { httpHeader: "x-auth-token" }]]];
      const opSchema = [
        9,
        "test",
        "DoThing",
        { http: ["POST", "/do", 200] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const request = makeRequest({ path: "/do", headers: { "x-auth-token": "secret" } });
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.token).toBe("secret");
    });

    it("deserializes JSON document body members", async () => {
      const inputSchema: any = [3, "test", "Input", 0, ["name", "count"], [0, 1]];
      const opSchema = [
        9,
        "test",
        "CreateItem",
        { http: ["POST", "/items", 201] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const body = new TextEncoder().encode(JSON.stringify({ name: "widget", count: 42 }));
      const request = makeRequest({ path: "/items", headers: { "content-type": "application/json" }, body });
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.name).toBe("widget");
      expect(result.count).toBe(42);
    });
  });

  describe("error serialization", () => {
    it("includes X-Amzn-Errortype header with error name", async () => {
      const error = new ServiceException({ name: "NotFoundError", $fault: "client", message: "Item not found" });
      const opSchema = [
        9,
        "test",
        "GetItem",
        { http: ["GET", "/items/{id}", 200] },
        "unit",
        "unit",
      ] satisfies StaticOperationSchema;

      const response = await protocol.serializeResponse(opSchema, makeContext(), error as any);
      expect(response.headers["x-amzn-errortype"]).toBe("NotFoundError");
      expect(response.headers["content-type"]).toBe("application/json");
    });

    it("uses 400 status for client faults", async () => {
      const error = new ServiceException({ name: "ValidationError", $fault: "client", message: "bad input" });
      const opSchema = [
        9,
        "test",
        "Op",
        { http: ["POST", "/op", 200] },
        "unit",
        "unit",
      ] satisfies StaticOperationSchema;

      const response = await protocol.serializeResponse(opSchema, makeContext(), error as any);
      expect(response.statusCode).toBe(400);
    });

    it("uses 500 status for server faults", async () => {
      const error = new ServiceException({ name: "InternalError", $fault: "server", message: "oops" });
      const opSchema = [
        9,
        "test",
        "Op",
        { http: ["POST", "/op", 200] },
        "unit",
        "unit",
      ] satisfies StaticOperationSchema;

      const response = await protocol.serializeResponse(opSchema, makeContext(), error as any);
      expect(response.statusCode).toBe(500);
    });

    it("body contains message but not __type", async () => {
      const error = new ServiceException({ name: "NotFoundError", $fault: "client", message: "not found" });
      const opSchema = [9, "test", "Op", { http: ["GET", "/op", 200] }, "unit", "unit"] satisfies StaticOperationSchema;

      const response = await protocol.serializeResponse(opSchema, makeContext(), error as any);
      const body = JSON.parse(new TextDecoder().decode(response.body as Uint8Array));
      expect(body.message).toBe("not found");
      expect(body.__type).toBeUndefined();
    });

    it("respects $metadata.httpStatusCode for custom status codes", async () => {
      const error = Object.assign(new Error("conflict"), {
        name: "ConflictError",
        $fault: "client",
        $metadata: { httpStatusCode: 409 },
      });
      const opSchema = [
        9,
        "test",
        "Op",
        { http: ["POST", "/op", 200] },
        "unit",
        "unit",
      ] satisfies StaticOperationSchema;

      const response = await protocol.serializeResponse(opSchema, makeContext(), error as any);
      expect(response.statusCode).toBe(409);
      expect(response.headers["x-amzn-errortype"]).toBe("ConflictError");
    });
  });

  describe("response serialization", () => {
    it("serializes output with httpResponseCode member", async () => {
      const outputSchema: any = [3, "test", "Output", 0, ["status"], [[1, { httpResponseCode: 1 }]]];
      const opSchema = [
        9,
        "test",
        "Op",
        { http: ["POST", "/op", 200] },
        "unit",
        () => outputSchema,
      ] satisfies StaticOperationSchema;

      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { status: 204 });
      expect(response.statusCode).toBe(204);
    });

    it("serializes output with httpHeader member", async () => {
      const outputSchema: any = [3, "test", "Output", 0, ["requestId"], [[0, { httpHeader: "x-request-id" }]]];
      const opSchema = [
        9,
        "test",
        "Op",
        { http: ["POST", "/op", 200] },
        "unit",
        () => outputSchema,
      ] satisfies StaticOperationSchema;

      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { requestId: "abc-123" });
      expect(response.headers["x-request-id"]).toBe("abc-123");
    });

    it("serializes document body members as JSON", async () => {
      const outputSchema: any = [3, "test", "Output", 0, ["name", "count"], [0, 1]];
      const opSchema = [
        9,
        "test",
        "Op",
        { http: ["POST", "/op", 200] },
        "unit",
        () => outputSchema,
      ] satisfies StaticOperationSchema;

      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { name: "item", count: 5 });
      expect(response.headers["content-type"]).toBe("application/json");
      const body = JSON.parse(new TextDecoder().decode(response.body as Uint8Array));
      expect(body.name).toBe("item");
      expect(body.count).toBe(5);
    });
  });
});
