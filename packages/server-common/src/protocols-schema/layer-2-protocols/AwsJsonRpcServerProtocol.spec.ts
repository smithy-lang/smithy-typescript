import { beforeEach, describe, expect, it } from "vitest";
import { AwsJsonRpcServerProtocol } from "./AwsJsonRpcServerProtocol";
import { ServiceException, UnsupportedMediaTypeException } from "../../validation/errors";
import type { HttpRequest as IHttpRequest, StaticOperationSchema } from "@smithy/types";

function makeRequest(headers: Record<string, string> = {}, body?: any): IHttpRequest {
  return {
    method: "POST",
    path: "/",
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

describe("AwsJsonRpcServerProtocol", () => {
  describe("version 1.0", () => {
    let protocol: AwsJsonRpcServerProtocol;

    beforeEach(() => {
      protocol = new AwsJsonRpcServerProtocol({ defaultNamespace: "com.example" });
      protocol.setSerdeContext(makeContext());
    });

    describe("protocol identification", () => {
      it("returns correct shape ID for 1.0", () => {
        expect(protocol.getShapeId()).toBe("aws.protocols#awsJson1_0");
      });
    });

    describe("content-type validation", () => {
      it("accepts application/x-amz-json-1.0", async () => {
        const request = makeRequest({ "content-type": "application/x-amz-json-1.0" });
        const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
        expect(result).toEqual({});
      });

      it("rejects wrong content type", async () => {
        const request = makeRequest({ "content-type": "application/json" });
        await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).rejects.toBeInstanceOf(
          UnsupportedMediaTypeException
        );
      });

      it("rejects application/x-amz-json-1.1 when configured as 1.0", async () => {
        const request = makeRequest({ "content-type": "application/x-amz-json-1.1" });
        await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).rejects.toBeInstanceOf(
          UnsupportedMediaTypeException
        );
      });

      it("allows missing content type (unit input)", async () => {
        const request = makeRequest({});
        const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
        expect(result).toEqual({});
      });
    });

    describe("deserialization", () => {
      it("returns empty object for unit schema", async () => {
        const request = makeRequest({ "content-type": "application/x-amz-json-1.0" });
        const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
        expect(result).toEqual({});
      });

      it("returns empty object for empty JSON body", async () => {
        const body = new TextEncoder().encode("{}");
        const inputSchema: any = [3, "test", "Input", 0, ["name"], [0]];
        const opSchema = [9, "test", "Op", 0, () => inputSchema, "unit"] satisfies StaticOperationSchema;
        const request = makeRequest({ "content-type": "application/x-amz-json-1.0" }, body);
        const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
        expect(result).toEqual({});
      });

      it("deserializes JSON body members", async () => {
        const body = new TextEncoder().encode(JSON.stringify({ name: "widget", count: 7 }));
        const inputSchema: any = [3, "test", "Input", 0, ["name", "count"], [0, 1]];
        const opSchema = [9, "test", "Op", 0, () => inputSchema, "unit"] satisfies StaticOperationSchema;
        const request = makeRequest({ "content-type": "application/x-amz-json-1.0" }, body);
        const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
        expect(result.name).toBe("widget");
        expect(result.count).toBe(7);
      });
    });

    describe("error serialization (1.0)", () => {
      it("includes __type with full shape ID", async () => {
        const error = new ServiceException({ name: "NotFoundError", $fault: "client", message: "not found" });
        const opSchema = makeUnitOpSchema();
        const response = await protocol.serializeResponse(opSchema, makeContext(), error as any);

        const body = JSON.parse(new TextDecoder().decode(response.body as Uint8Array));
        expect(body.__type).toBe("com.example#NotFoundError");
      });

      it("includes message in body", async () => {
        const error = new ServiceException({ name: "BadRequest", $fault: "client", message: "invalid input" });
        const opSchema = makeUnitOpSchema();
        const response = await protocol.serializeResponse(opSchema, makeContext(), error as any);

        const body = JSON.parse(new TextDecoder().decode(response.body as Uint8Array));
        expect(body.message).toBe("invalid input");
      });

      it("uses 400 for client faults", async () => {
        const error = new ServiceException({ name: "BadRequest", $fault: "client", message: "bad" });
        const response = await protocol.serializeResponse(makeUnitOpSchema(), makeContext(), error as any);
        expect(response.statusCode).toBe(400);
      });

      it("uses 500 for server faults", async () => {
        const error = new ServiceException({ name: "InternalError", $fault: "server", message: "oops" });
        const response = await protocol.serializeResponse(makeUnitOpSchema(), makeContext(), error as any);
        expect(response.statusCode).toBe(500);
      });

      it("sets content-type to application/x-amz-json-1.0", async () => {
        const error = new ServiceException({ name: "Err", $fault: "client", message: "x" });
        const response = await protocol.serializeResponse(makeUnitOpSchema(), makeContext(), error as any);
        expect(response.headers["content-type"]).toBe("application/x-amz-json-1.0");
      });

      it("does NOT include X-Amzn-Errortype header (uses __type body field instead)", async () => {
        const error = new ServiceException({ name: "Err", $fault: "client", message: "x" });
        const response = await protocol.serializeResponse(makeUnitOpSchema(), makeContext(), error as any);
        expect(response.headers["x-amzn-errortype"]).toBeUndefined();
      });
    });

    describe("response serialization", () => {
      it("serializes output as JSON body with correct content-type", async () => {
        const outputSchema: any = [3, "test", "Output", 0, ["result"], [0]];
        const opSchema = [9, "test", "Op", 0, "unit", () => outputSchema] satisfies StaticOperationSchema;

        const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { result: "ok" });
        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toBe("application/x-amz-json-1.0");
        const body = JSON.parse(new TextDecoder().decode(response.body as Uint8Array));
        expect(body.result).toBe("ok");
      });
    });
  });

  describe("version 1.1", () => {
    let protocol: AwsJsonRpcServerProtocol;

    beforeEach(() => {
      protocol = new AwsJsonRpcServerProtocol({ defaultNamespace: "com.example", isVersion1_1: true });
      protocol.setSerdeContext(makeContext());
    });

    describe("protocol identification", () => {
      it("returns correct shape ID for 1.1", () => {
        expect(protocol.getShapeId()).toBe("aws.protocols#awsJson1_1");
      });
    });

    describe("content-type validation", () => {
      it("accepts application/x-amz-json-1.1", async () => {
        const request = makeRequest({ "content-type": "application/x-amz-json-1.1" });
        const result = await protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request);
        expect(result).toEqual({});
      });

      it("rejects application/x-amz-json-1.0 when configured as 1.1", async () => {
        const request = makeRequest({ "content-type": "application/x-amz-json-1.0" });
        await expect(protocol.deserializeRequest(makeUnitOpSchema(), makeContext(), request)).rejects.toBeInstanceOf(
          UnsupportedMediaTypeException
        );
      });
    });

    describe("error serialization (1.1)", () => {
      it("includes __type with shape name only (no namespace)", async () => {
        const error = new ServiceException({ name: "NotFoundError", $fault: "client", message: "not found" });
        const opSchema = makeUnitOpSchema();
        const response = await protocol.serializeResponse(opSchema, makeContext(), error as any);

        const body = JSON.parse(new TextDecoder().decode(response.body as Uint8Array));
        expect(body.__type).toBe("NotFoundError");
      });

      it("sets content-type to application/x-amz-json-1.1", async () => {
        const error = new ServiceException({ name: "Err", $fault: "client", message: "x" });
        const response = await protocol.serializeResponse(makeUnitOpSchema(), makeContext(), error as any);
        expect(response.headers["content-type"]).toBe("application/x-amz-json-1.1");
      });
    });

    describe("response serialization", () => {
      it("uses correct content-type for 1.1", async () => {
        const outputSchema: any = [3, "test", "Output", 0, ["value"], [1]];
        const opSchema = [9, "test", "Op", 0, "unit", () => outputSchema] satisfies StaticOperationSchema;

        const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { value: 42 });
        expect(response.headers["content-type"]).toBe("application/x-amz-json-1.1");
      });
    });
  });
});
