/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { hasOwn } from "@smithy/core/serde";
import type { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { Logger, StaticOperationSchema } from "@smithy/types";

import type { ServerProtocol } from "../protocols-schema/layer-0-interface-and-base/ServerProtocol";
import { NormalizedSchema } from "@smithy/core/schema";

/**
 * Result of routing a request: the claimed protocol and matched operation.
 * If `operationName` is undefined, the request did not match any operation
 * (UnknownOperationException).
 *
 * @public
 */
export interface RouteResult {
  protocol: ServerProtocol<HttpRequest, HttpResponse>;
  operationName: string | undefined;
}

/**
 * A router identifies which protocol claims the request and resolves the
 * operation name. Returns `undefined` if no protocol claims the request.
 *
 * @public
 */
export type RouterFunction = (
  request: HttpRequest,
  protocols: Record<string, ServerProtocol<HttpRequest, HttpResponse>>,
  operationSchemas: Record<string, StaticOperationSchema>,
  logger?: Logger
) => RouteResult | undefined;

/**
 * Smithy RPC v2 router. Claims requests whose path matches
 * `/service/{service}/operation/{operation}` and whose `smithy-protocol`
 * header is `rpc-v2-cbor` (or the matching registered protocol).
 *
 * This routing behavior is shared by smithy.protocols#rpcv2Cbor and
 * smithy.protocols#rpcv2Json. AWS JSON 1.0/1.1 use a different routing
 * mechanism (X-Amz-Target header).
 *
 * @internal
 */
export function smithyRpcV2Router(
  request: HttpRequest,
  protocols: Record<string, ServerProtocol<HttpRequest, HttpResponse>>,
  operationSchemas: Record<string, StaticOperationSchema>,
  logger?: Logger
): RouteResult | undefined {
  const logPrefix = `@smithy/server-common::smithyRpcV2Router`;
  const smithyProtocolValue = getHeaderValue(request, "smithy-protocol") ?? "";

  if (!["rpc-v2-cbor", "rpc-v2-json"].includes(smithyProtocolValue)) {
    logger?.debug?.(`${logPrefix}: smithy-protocol header not matched.`);
    return;
  }

  const match = RPC_ROUTE_RE.exec(request.path);
  if (!match) {
    logger?.debug?.(`${logPrefix}: RPC_ROUTE pattern not matched.`);
    return undefined;
  }

  const opName = match[1];
  const operationName = opName in operationSchemas ? opName : undefined;

  const protocolSelector = {
    "rpc-v2-cbor": protocols["smithy.protocols#rpcv2Cbor"],
    "rpc-v2-json": protocols["smithy.protocols#rpcv2Json"],
  };
  const protocol = protocolSelector[smithyProtocolValue as "rpc-v2-cbor" | "rpc-v2-json"];

  if (operationName && protocol) {
    logger?.debug?.(`${logPrefix}: resolving ${operationName} route and ${protocol.constructor.name}.`);
    return {
      operationName,
      protocol,
    };
  }

  if (!operationName) {
    logger?.debug?.(`${logPrefix}: no matching operation name.`);
  } else {
    logger?.debug?.(`${logPrefix}: protocol implementation not supplied for ${smithyProtocolValue}.`);
  }
  return undefined;
}

const RPC_ROUTE_RE = /\/service\/[^/]+\/operation\/([^/?]+)/;

/**
 * REST HTTP binding router. Claims requests by matching the HTTP method and
 * path template from each operation's `http` trait. Identifies the protocol
 * by content-type or other header signals.
 *
 * Operations are ranked by specificity (literal segment count) so that
 * greedy label patterns like `/{id}` don't shadow specific paths like `/get-numbers`.
 *
 * @internal
 */
export function httpBindingRouter(
  request: HttpRequest,
  protocols: Record<string, ServerProtocol<HttpRequest, HttpResponse>>,
  operationSchemas: Record<string, StaticOperationSchema>,
  logger?: Logger
): RouteResult | undefined {
  const logPrefix = `@smithy/server-common::httpBindingRouter`;
  const method = request.method.toUpperCase();
  const requestPath = request.path.split("?")[0];

  // Build candidates with specificity ranking.
  type Candidate = { opName: string; regex: RegExp; literalCount: number };
  const candidates: Candidate[] = [];

  for (const [opName, schema] of Object.entries(operationSchemas)) {
    const traits = NormalizedSchema.of(schema).getMergedTraits();
    if (!traits.http) {
      continue;
    }

    const [opMethod, templatePath] = traits.http as [string, string, number];
    if (opMethod.toUpperCase() !== method) {
      continue;
    }

    const pathOnly = templatePath.split("?")[0];
    const segments = pathOnly.split("/").filter(Boolean);
    const literalCount = segments.filter((s) => !s.startsWith("{")).length;
    const regexStr = pathOnly.replace(/\{(\w+)\+\}/g, "(.+)").replace(/\{(\w+)\}/g, "([^/]+)");
    const regex = new RegExp(`^${regexStr}$`);

    candidates.push({ opName, regex, literalCount });
  }

  // Sort by literal segment count descending — more specific paths first.
  candidates.sort((a, b) => b.literalCount - a.literalCount);

  let operationName: string | undefined;
  for (const { opName, regex } of candidates) {
    if (regex.test(requestPath)) {
      operationName = opName;
      break;
    }
  }

  if (operationName === undefined) {
    logger?.debug?.(`${logPrefix}: no matching operation.`);
    return undefined;
  }
  if (!protocols["aws.protocols#restJson1"]) {
    logger?.debug?.(`${logPrefix}: missing protocol implementation.`);
    return undefined;
  }

  logger?.debug?.(
    `${logPrefix}: resolving ${operationName} route and ${protocols["aws.protocols#restJson1"].constructor.name}.`
  );
  return {
    operationName,
    protocol: protocols["aws.protocols#restJson1"],
  };
}

/**
 * AWS JSON RPC router. Claims requests that are `POST /` with an
 * `X-Amz-Target` header matching `{ServiceName}.{OperationName}`.
 *
 * Used by aws.protocols#awsJson1_0 and aws.protocols#awsJson1_1.
 *
 * @internal
 */
export function awsJsonRpcRouter(
  request: HttpRequest,
  protocols: Record<string, ServerProtocol<HttpRequest, HttpResponse>>,
  operationSchemas: Record<string, StaticOperationSchema>,
  logger?: Logger
): RouteResult | undefined {
  const logPrefix = `@smithy/server-common::awsJsonRpcRouter`;

  if (request.method.toUpperCase() !== "POST") return undefined;

  const target = getHeaderValue(request, "x-amz-target");
  if (!target) {
    logger?.debug?.(`${logPrefix}: no X-Amz-Target header.`);
    return undefined;
  }

  // X-Amz-Target format: {ServiceName}.{OperationName}
  const dotIndex = target.lastIndexOf(".");
  if (dotIndex < 0) {
    logger?.debug?.(`${logPrefix}: malformed X-Amz-Target value "${target}" (no dot separator).`);
    return undefined;
  }

  const opName = target.slice(dotIndex + 1);
  const operationName = opName in operationSchemas ? opName : undefined;

  if (!operationName) {
    logger?.debug?.(`${logPrefix}: no matching operation for "${opName}".`);
  }

  // Find the matching AWS JSON protocol.
  const protocol = protocols["aws.protocols#awsJson1_0"] ?? protocols["aws.protocols#awsJson1_1"];
  if (!protocol) {
    logger?.debug?.(`${logPrefix}: no AWS JSON protocol implementation registered.`);
    return undefined;
  }

  logger?.debug?.(`${logPrefix}: resolving ${operationName ?? "(unknown)"} route and ${protocol.constructor.name}.`);
  return { protocol, operationName };
}

/**
 * Creates a combined router but only for the included protocols.
 * @internal
 */
export function createCombinedRouter(protocols: Record<string, ServerProtocol<HttpRequest, HttpResponse>>) {
  const routerFunctions: RouterFunction[] = [];

  // first priority routing
  if ("smithy.protocols#rpcv2Cbor" in protocols || "smithy.protocols#rpcV2Json" in protocols) {
    routerFunctions.push(smithyRpcV2Router);
  }
  // second priority routing
  if ("aws.protocols#awsJson1_0" in protocols || "aws.protocols#awsJson1_1" in protocols) {
    routerFunctions.push(awsJsonRpcRouter);
  }
  // third priority routing
  if ("aws.protocols#restJson1" in protocols) {
    routerFunctions.push(httpBindingRouter);
  }

  /**
   * Combined router that tries Smithy RPC v2 routing first, then AWS JSON RPC,
   * then falls back to HTTP binding routing. Use when the server supports
   * multiple protocol families.
   *
   * @internal
   */
  return function combinedRouter(
    request: HttpRequest,
    protocols: Record<string, ServerProtocol<HttpRequest, HttpResponse>>,
    operationSchemas: Record<string, StaticOperationSchema>,
    logger?: Logger
  ): RouteResult | undefined {
    logger?.debug?.(`@smithy/server-common::combinedRouter: received ${request.method} ${request.path}`);
    for (const routerFn of routerFunctions) {
      const result = routerFn(request, protocols, operationSchemas, logger);
      if (result) {
        return result;
      }
    }
  };
}

/**
 * Gets a header value from a request by case-insensitive name.
 */
function getHeaderValue(request: HttpRequest, name: string): string | undefined {
  for (const key in request.headers) {
    if (!hasOwn(request.headers, key)) continue;
    if (key.toLowerCase() === name) {
      return request.headers[key];
    }
  }
  return undefined;
}
