import { NormalizedSchema, op } from "@smithy/core/schema";
import { HttpRequest, HttpResponse } from "@smithy/core/transport";
import type {
  CodecSettings,
  Schema,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
  StaticStructureSchema,
  TimestampEpochSecondsSchema,
} from "@smithy/types";
import { describe, expect, it, vi } from "vitest";

import {
  getHttpOperationBindingExtension,
  getHttpStructBindingExtension,
  HttpBindingValueKind,
} from "../HttpBindingSchemaExtension";
import { HttpBindingDeserializer } from "./HttpBindingDeserializer";
import { HttpBindingSerializer } from "./HttpBindingSerializer";
import { HttpInterceptingShapeDeserializer } from "./HttpInterceptingShapeDeserializer";
import { HttpInterceptingShapeSerializer } from "./HttpInterceptingShapeSerializer";
import { ToStringShapeSerializer } from "./ToStringShapeSerializer";

const settings: CodecSettings = {
  timestampFormat: {
    useTrait: true,
    default: 7 satisfies TimestampEpochSecondsSchema,
  },
  httpBindings: true,
};

class JsonTestSerializer implements ShapeSerializer<string> {
  private buffer = "";

  public setSerdeContext(_: SerdeFunctions): void {}

  public write(_: Schema, value: unknown): void {
    this.buffer = JSON.stringify(value);
  }

  public flush(): string {
    const buffer = this.buffer;
    this.buffer = "";
    return buffer;
  }
}

class JsonTestDeserializer implements ShapeDeserializer<string | Uint8Array> {
  public setSerdeContext(_: SerdeFunctions): void {}

  public read(_: Schema, data: string | Uint8Array): any {
    return JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
  }
}

describe("HTTP binding serde wrappers", () => {
  it("routes request members without invoking interceptor trait dispatch", () => {
    const inputSchema = [
      3,
      "example",
      "Input",
      0,
      ["label", "greedy", "header", "query", "body"],
      [[0, { httpLabel: 1 }], [0, { httpLabel: 1 }], [0, { httpHeader: "X-Test" }], [0, { httpQuery: "q" }], 0],
    ] satisfies StaticStructureSchema;
    const schema = NormalizedSchema.of(inputSchema);
    const operationBinding = getHttpOperationBindingExtension(
      op("example", "Operation", { http: ["POST", "/things/{label}/{greedy+}", 200] }, inputSchema, "unit")
    );
    const interceptor = new HttpInterceptingShapeSerializer(new JsonTestSerializer(), settings);
    const interceptorWrite = vi.spyOn(interceptor, "write");
    const directWrite = vi.spyOn(interceptor, "writeHttpBinding");
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      hostname: "example.com",
      path: "/things/{label}/{greedy+}",
      headers: {},
      query: {},
    });

    new HttpBindingSerializer(interceptor, getHttpStructBindingExtension(schema).request(), operationBinding).serialize(
      {
        label: "a/b",
        greedy: "c/d e",
        header: "header-value",
        query: "query-value",
        body: "body-value",
      },
      request,
      schema
    );

    expect(interceptorWrite).not.toHaveBeenCalled();
    expect(directWrite.mock.calls.every((call) => call[3] !== undefined)).toBe(true);
    expect(request.path).toBe("/things/a%2Fb/c/d%20e");
    expect(request.headers).toEqual({ "x-test": "header-value" });
    expect(request.query).toEqual({ q: "query-value" });
    expect(JSON.parse(request.body)).toMatchObject({ body: "body-value" });
  });

  it("preserves URI placeholders without modeled label bindings", () => {
    const inputSchema = [3, "example", "Input", 0, [], []] satisfies StaticStructureSchema;
    const schema = NormalizedSchema.of(inputSchema);
    const operationBinding = getHttpOperationBindingExtension(
      op("example", "Operation", { http: ["POST", "/{Bucket}", 200] }, inputSchema, "unit")
    );
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      hostname: "example.com",
      path: "/{Bucket}",
      headers: {},
      query: {},
    });

    new HttpBindingSerializer(
      new JsonTestSerializer(),
      getHttpStructBindingExtension(schema).request(),
      operationBinding
    ).serialize({}, request, schema);

    expect(request.path).toBe("/{Bucket}");
  });

  it("preserves header formatting for prefix headers with a plain serializer", () => {
    const inputSchema = [
      3,
      "example",
      "Input",
      0,
      ["timestamps", "media"],
      [
        [[2, "example", "Timestamps", 0, 0, 4], { httpPrefixHeaders: "X-Time-" }],
        [[2, "example", "Media", 0, 0, [0, { mediaType: "application/json" }]], { httpPrefixHeaders: "X-Media-" }],
      ],
    ] satisfies StaticStructureSchema;
    const schema = NormalizedSchema.of(inputSchema);
    const operationBinding = getHttpOperationBindingExtension(
      op("example", "Operation", { http: ["POST", "/", 200] }, inputSchema, "unit")
    );
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      hostname: "example.com",
      path: "/",
      headers: {},
      query: {},
    });

    new HttpBindingSerializer(
      new ToStringShapeSerializer(settings),
      getHttpStructBindingExtension(schema).request(),
      operationBinding
    ).serialize(
      {
        timestamps: {
          created: new Date("2020-01-01T00:00:00Z"),
        },
        media: {
          document: '{"key":"value"}',
        },
      },
      request,
      schema
    );

    expect(request.headers).toEqual({
      "x-time-created": "Wed, 01 Jan 2020 00:00:00 GMT",
      "x-media-document": "eyJrZXkiOiJ2YWx1ZSJ9",
    });
  });

  it("routes response members without invoking interceptor trait dispatch", async () => {
    const schema = NormalizedSchema.of([
      3,
      "example",
      "Output",
      0,
      ["header", "absentHeader", "body"],
      [[1, { httpHeader: "X-Count" }], [0, { httpHeader: "X-Absent" }], 0],
    ] satisfies StaticStructureSchema);
    const interceptor = new HttpInterceptingShapeDeserializer(new JsonTestDeserializer(), settings);
    const interceptorRead = vi.spyOn(interceptor, "read");
    const directRead = vi.spyOn(interceptor, "readHttpBinding");
    const response = new HttpResponse({
      statusCode: 200,
      headers: {
        "X-Count": "42",
        "X-Unmodeled": "ignored",
      },
      body: new TextEncoder().encode('{"body":"body-value"}'),
    });
    const output: any = {};
    const bindingDeserializer = new HttpBindingDeserializer(
      interceptor,
      getHttpStructBindingExtension(schema).response()
    );

    await bindingDeserializer.deserialize(schema, {} as any, response, output, true);

    expect(interceptorRead).not.toHaveBeenCalled();
    expect(directRead).toHaveBeenCalledTimes(1);
    expect(directRead.mock.calls[0][3]).toMatchObject({
      kind: HttpBindingValueKind.NUMBER,
    });
    expect(output).toEqual({
      header: 42,
      body: "body-value",
    });
  });
});
