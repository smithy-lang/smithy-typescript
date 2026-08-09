/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { URL, type URLSearchParams } from "node:url";
import { HttpRequest, type HeaderBag, type HttpResponse } from "@smithy/core/protocols";
import type { QueryParameterBag } from "@smithy/types";

function convertHeaders(headers: IncomingHttpHeaders): HeaderBag {
  const result: HeaderBag = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    result[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return result;
}

function convertQueryString(queryParams: URLSearchParams): QueryParameterBag {
  const result: QueryParameterBag = {};
  for (const key of queryParams.keys()) {
    const values = queryParams.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
}

export function convertRequest(req: IncomingMessage): HttpRequest {
  const url = new URL(req.url || "", `http://${req.headers.host}`);

  return new HttpRequest({
    hostname: url.hostname,
    method: req.method,
    path: url.pathname,
    protocol: url.protocol,
    query: convertQueryString(url.searchParams),
    headers: convertHeaders(req.headers),
    body: req,
  });
}

export function writeResponse(httpResponse: HttpResponse, res: ServerResponse) {
  if (!httpResponse) {
    res.statusCode = 500;
    res.end("Error processing request");
    return;
  }
  res.statusCode = httpResponse.statusCode;
  for (const [key, value] of Object.entries(httpResponse.headers)) {
    res.setHeader(key, value);
  }
  if (httpResponse.body) {
    res.end(httpResponse.body);
  } else {
    res.end();
  }
}
