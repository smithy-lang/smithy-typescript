/*
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *   http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

import { HttpRequest, HttpResponse } from "@aws-sdk/protocol-http";
import { HeaderBag, QueryParameterBag } from "@aws-sdk/types";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { Readable } from "stream";

export function convertEvent(event: APIGatewayProxyEvent): HttpRequest;
export function convertEvent(event: APIGatewayProxyEventV2): HttpRequest;

export function convertEvent(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): HttpRequest {
  if (isV2Event(event)) {
    return convertV2Event(event);
  } else {
    return convertV1Event(event);
  }
}

function convertV1Event(event: APIGatewayProxyEvent): HttpRequest {
  return new HttpRequest({
    method: event.httpMethod,
    headers: convertMultiValueHeaders(event.multiValueHeaders),
    query: convertMultiValueQueryStringParameters(event.multiValueQueryStringParameters),
    path: event.path,
    ...(event.body ? { body: Readable.from(Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")) } : {}),
  });
}

function convertV2Event(event: APIGatewayProxyEventV2): HttpRequest {
  return new HttpRequest({
    method: event.requestContext.http.method,
    headers: convertHeaders(event.headers),
    query: convertQuery(event.queryStringParameters),
    path: event.rawPath,
    ...(event.body ? { body: Readable.from(Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")) } : {}),
  });
}

export const convertVersion2Response = convertResponse;
export function convertResponse(response: HttpResponse): APIGatewayProxyResultV2 {
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
    isBase64Encoded: false,
  };
}

export function convertVersion1Response(response: HttpResponse): APIGatewayProxyResult {
  return {
    statusCode: response.statusCode,
    multiValueHeaders: convertResponseHeaders(response.headers),
    body: response.body,
    isBase64Encoded: false,
  };
}
function convertResponseHeaders(headers: HeaderBag) {
  const retVal: { [key: string]: string[] } = {};
  for (const [key, val] of Object.entries(headers)) {
    retVal[key] = val.split(",").map((v) => v.trim());
  }
  return retVal;
}

function isV2Event(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): event is APIGatewayProxyEventV2 {
  return hasVersion(event) && event.version === "2.0";
}

function hasVersion(event: any): event is Record<"version", string> {
  return event.hasOwnProperty("version");
}

function convertMultiValueHeaders(multiValueHeaders: APIGatewayProxyEventMultiValueHeaders | null) {
  const retVal: { [key: string]: string } = {};

  if (multiValueHeaders === null) {
    return retVal;
  }

  for (const [key, val] of Object.entries(multiValueHeaders)) {
    if (val !== undefined) {
      retVal[key] = val.join(", ");
    }
  }

  return retVal;
}

// TODO: this can be rewritten with arrow functions / Object.fromEntries / filter
// but first we need to split up generated client and servers so we can have different
// language version targets.
function convertHeaders(headers: APIGatewayProxyEventHeaders): HeaderBag {
  const retVal: { [key: string]: string } = {};

  for (const [key, val] of Object.entries(headers)) {
    if (val !== undefined) {
      retVal[key] = val;
    }
  }

  return retVal;
}

function convertMultiValueQueryStringParameters(params: APIGatewayProxyEventMultiValueQueryStringParameters | null) {
  if (params === undefined || params === null) {
    return undefined;
  }

  const retVal: { [key: string]: string[] } = {};

  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) {
      retVal[key] = val;
    }
  }

  return retVal;
}

// TODO: this can be rewritten with arrow functions / Object.fromEntries / filter
function convertQuery(params: APIGatewayProxyEventQueryStringParameters | undefined): QueryParameterBag | undefined {
  if (params === undefined) {
    return undefined;
  }

  const retVal: { [key: string]: string | string[] } = {};

  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) {
      if (val.indexOf(",") !== -1) {
        retVal[key] = val;
      } else {
        retVal[key] = val.split(",");
      }
    }
  }

  return retVal;
}
