/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { Logger } from "@smithy/types";

import type { ServerProtocol } from "../protocols-schema/layer-0-interface-and-base/ServerProtocol";

/**
 * Result of protocol claiming.
 *
 * @public
 */
export interface RouteResult {
  readonly protocol: ServerProtocol<HttpRequest, HttpResponse>;
}

/**
 * A router identifies which protocol claims the request. Operation routing
 * remains protocol-owned and runs later in the request pipeline.
 *
 * @public
 */
export type RouterFunction = (request: HttpRequest, logger?: Logger) => RouteResult | undefined;

/**
 * Creates a router that asks protocols to claim requests in registration order.
 * The order of the protocol array is the routing priority.
 *
 * @internal
 */
export function createCombinedRouter(
  configuredProtocols: readonly ServerProtocol<HttpRequest, HttpResponse>[]
): RouterFunction {
  return function combinedRouter(request: HttpRequest, logger?: Logger): RouteResult | undefined {
    logger?.debug?.(`@smithy/server-common::combinedRouter: received ${request.method} ${request.path}`);
    for (const protocol of configuredProtocols) {
      if (protocol.claim(request, logger)) {
        return { protocol };
      }
    }
    return undefined;
  };
}
