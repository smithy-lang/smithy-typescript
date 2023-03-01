/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { HttpRequest, HttpResponse } from "@aws-sdk/protocol-http";
import { HeaderBag, QueryParameterBag } from "@aws-sdk/types";
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "http";
import { URL, URLSearchParams } from "url";

function convertHeaders(headers: IncomingHttpHeaders): HeaderBag {
  // TODO make this proper
  return Object.fromEntries(Object.entries(headers).filter((x) => x)) as HeaderBag;
}

function convertQueryString(qs: URLSearchParams): QueryParameterBag {
  return Object.fromEntries(qs.entries());
}

export function convertRequest(req: IncomingMessage): HttpRequest {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  return new HttpRequest({
    method: req.method,
    headers: convertHeaders(req.headers),
    query: convertQueryString(url.searchParams),
    path: url.pathname,
    body: req,
  });
}

export function writeResponse(httpResponse: HttpResponse, res: ServerResponse) {
  if (!httpResponse) {
    res.statusCode = 500;
    res.write("Error processing request");
    res.end();
    return;
  }
  res.statusCode = httpResponse.statusCode;
  Object.entries(httpResponse.headers).forEach(([key, value]) => res.setHeader(key, value));
  res.write(httpResponse.body);
  res.end();
}
