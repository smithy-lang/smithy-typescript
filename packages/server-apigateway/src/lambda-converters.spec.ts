/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from "aws-lambda";
import type { HttpResponse } from "@smithy/core/protocols";

import { convertEvent, convertVersion1Response, convertVersion2Response } from "./lambda-converters";

function makeV2Event(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/test",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "id.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "id",
      http: {
        method: "GET",
        path: "/test",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "id",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2000:00:00:00 +0000",
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

function makeV1Event(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: "/test",
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: "",
    body: null,
    isBase64Encoded: false,
    ...overrides,
  };
}

describe("convertEvent", () => {
  describe("v2 events", () => {
    it("extracts method and path", () => {
      const event = makeV2Event();
      const request = convertEvent(event);
      expect(request.method).toBe("GET");
      expect(request.path).toBe("/test");
    });

    it("omits undefined header values", () => {
      const event = makeV2Event({
        headers: { "content-type": "application/json", "x-custom": undefined } as any,
      });
      const request = convertEvent(event);
      expect(request.headers).toEqual({ "content-type": "application/json" });
      expect("x-custom" in request.headers).toBe(false);
    });

    it("converts query parameters", () => {
      const event = makeV2Event({
        queryStringParameters: { q: "hello", page: "1" },
      } as any);
      const request = convertEvent(event);
      expect(request.query).toEqual({ q: "hello", page: "1" });
    });

    it("handles missing query parameters", () => {
      const event = makeV2Event({ queryStringParameters: undefined } as any);
      const request = convertEvent(event);
      expect(request.query).toEqual({});
    });

    it("decodes base64 body", async () => {
      const event = makeV2Event({
        body: Buffer.from("hello binary").toString("base64"),
        isBase64Encoded: true,
      });
      const request = convertEvent(event);
      const chunks: Buffer[] = [];
      for await (const chunk of request.body) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString("utf-8")).toBe("hello binary");
    });

    it("decodes utf8 body", async () => {
      const event = makeV2Event({
        body: '{"key":"value"}',
        isBase64Encoded: false,
      });
      const request = convertEvent(event);
      const chunks: Buffer[] = [];
      for await (const chunk of request.body) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString("utf-8")).toBe('{"key":"value"}');
    });

    it("handles missing body", () => {
      const event = makeV2Event({ body: undefined });
      const request = convertEvent(event);
      expect(request.body).toBeUndefined();
    });
  });

  describe("v1 events", () => {
    it("extracts method and path", () => {
      const event = makeV1Event({ httpMethod: "POST", path: "/items" });
      const request = convertEvent(event);
      expect(request.method).toBe("POST");
      expect(request.path).toBe("/items");
    });

    it("joins multi-value headers", () => {
      const event = makeV1Event({
        multiValueHeaders: {
          "set-cookie": ["a=1", "b=2"],
          "content-type": ["application/json"],
        },
      });
      const request = convertEvent(event);
      expect(request.headers["set-cookie"]).toBe("a=1, b=2");
      expect(request.headers["content-type"]).toBe("application/json");
    });

    it("converts multi-value query parameters", () => {
      const event = makeV1Event({
        multiValueQueryStringParameters: {
          tag: ["a", "b", "c"],
          single: ["one"],
        },
      });
      const request = convertEvent(event);
      expect(request.query).toEqual({ tag: ["a", "b", "c"], single: "one" });
    });

    it("handles null multiValueQueryStringParameters", () => {
      const event = makeV1Event({ multiValueQueryStringParameters: null });
      const request = convertEvent(event);
      expect(request.query).toEqual({});
    });

    it("handles null multiValueHeaders", () => {
      const event = makeV1Event({ multiValueHeaders: null as any });
      const request = convertEvent(event);
      expect(request.headers).toEqual({});
    });
  });
});

describe("convertVersion2Response", () => {
  it("converts a string body response", () => {
    const httpResponse = {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: '{"ok":true}',
    } as HttpResponse;

    const result = convertVersion2Response(httpResponse);
    expect(typeof result).not.toBe("string");
    const structured = result as Exclude<typeof result, string>;
    expect(structured.statusCode).toBe(200);
    expect(structured.headers).toEqual({ "content-type": "application/json" });
    expect(structured.body).toBe('{"ok":true}');
    expect(structured.isBase64Encoded).toBe(false);
  });

  it("base64 encodes Uint8Array body", () => {
    const httpResponse: HttpResponse = {
      statusCode: 200,
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1, 2, 3, 4]),
    };

    const result = convertVersion2Response(httpResponse);
    expect(typeof result).not.toBe("string");
    const structured = result as Exclude<typeof result, string>;
    expect(structured.isBase64Encoded).toBe(true);
    expect(structured.body).toBe(Buffer.from([1, 2, 3, 4]).toString("base64"));
  });
});

describe("convertVersion1Response", () => {
  it("converts a string body response with multi-value headers", () => {
    const httpResponse = {
      statusCode: 201,
      headers: { "x-values": "a, b, c", "content-type": "text/plain" },
      body: "created",
    } as HttpResponse;

    const result = convertVersion1Response(httpResponse);
    expect(result.statusCode).toBe(201);
    expect(result.multiValueHeaders).toEqual({
      "x-values": ["a", "b", "c"],
      "content-type": ["text/plain"],
    });
    expect(result.body).toBe("created");
    expect(result.isBase64Encoded).toBe(false);
  });

  it("base64 encodes Uint8Array body", () => {
    const httpResponse: HttpResponse = {
      statusCode: 200,
      headers: {},
      body: new Uint8Array([10, 20, 30]),
    };

    const result = convertVersion1Response(httpResponse);
    expect(result.isBase64Encoded).toBe(true);
    expect(result.body).toBe(Buffer.from([10, 20, 30]).toString("base64"));
  });

  it("handles undefined body", () => {
    const httpResponse: HttpResponse = {
      statusCode: 204,
      headers: {},
      body: undefined,
    };

    const result = convertVersion1Response(httpResponse);
    expect(result.body).toBe("");
    expect(result.isBase64Encoded).toBe(false);
  });
});
