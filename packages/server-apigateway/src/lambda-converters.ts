/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Readable } from "node:stream";
import { HttpRequest, type HeaderBag, type HttpResponse } from "@smithy/core/protocols";
import type { QueryParameterBag } from "@smithy/types";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventMultiValueHeaders,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyResultV2,
} from "aws-lambda";

export function convertEvent(event: APIGatewayProxyEvent): HttpRequest;
export function convertEvent(event: APIGatewayProxyEventV2): HttpRequest;

/**
 * Converts an API Gateway proxy event (v1 or v2) into an HttpRequest.
 */
export function convertEvent(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): HttpRequest {
  if (isV2Event(event)) {
    return convertV2Event(event);
  }
  return convertV1Event(event);
}

/**
 * Converts an HttpResponse into an API Gateway v2 proxy result.
 */
export function convertVersion2Response(response: HttpResponse): APIGatewayProxyResultV2 {
  const body = response.body;
  const isBase64 = body instanceof Uint8Array;
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: isBase64 ? Buffer.from(body).toString("base64") : body,
    isBase64Encoded: isBase64,
  };
}

/**
 * Converts an HttpResponse into an API Gateway v1 proxy result.
 */
export function convertVersion1Response(response: HttpResponse): APIGatewayProxyResult {
  const body = response.body;
  const isBase64 = body instanceof Uint8Array;
  return {
    statusCode: response.statusCode,
    multiValueHeaders: expandHeaders(response.headers),
    body: isBase64 ? Buffer.from(body).toString("base64") : (body ?? ""),
    isBase64Encoded: isBase64,
  };
}

function convertV1Event(event: APIGatewayProxyEvent): HttpRequest {
  return new HttpRequest({
    method: event.httpMethod,
    headers: joinMultiValueHeaders(event.multiValueHeaders),
    query: convertMultiValueQuery(event.multiValueQueryStringParameters),
    path: event.path,
    ...(event.body ? { body: Readable.from(Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")) } : {}),
  });
}

function convertV2Event(event: APIGatewayProxyEventV2): HttpRequest {
  return new HttpRequest({
    method: event.requestContext.http.method,
    headers: filterUndefined(event.headers),
    query: filterUndefined(event.queryStringParameters),
    path: event.rawPath,
    ...(event.body ? { body: Readable.from(Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")) } : {}),
  });
}

function isV2Event(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): event is APIGatewayProxyEventV2 {
  return "version" in event && event.version === "2.0";
}

function joinMultiValueHeaders(multiValueHeaders: APIGatewayProxyEventMultiValueHeaders | null): HeaderBag {
  const result: HeaderBag = {};
  if (!multiValueHeaders) {
    return result;
  }
  for (const [key, values] of Object.entries(multiValueHeaders)) {
    if (values !== undefined) {
      result[key] = values.join(", ");
    }
  }
  return result;
}

function convertMultiValueQuery(
  params: APIGatewayProxyEventMultiValueQueryStringParameters | null
): QueryParameterBag | undefined {
  if (!params) {
    return undefined;
  }
  const result: QueryParameterBag = {};
  for (const [key, values] of Object.entries(params)) {
    if (values !== undefined) {
      result[key] = values.length === 1 ? values[0] : values;
    }
  }
  return result;
}

function filterUndefined(record: Record<string, string | undefined> | undefined): Record<string, string> | undefined {
  if (!record) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Expands single-value headers into multi-value format for v1 responses.
 */
function expandHeaders(headers: HeaderBag): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = value.split(",").map((v) => v.trim());
  }
  return result;
}
