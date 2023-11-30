import type { Agent as hAgent } from "http";
import type { Agent as hsAgent } from "https";

/**
 *
 * This type represents an alternate client constructor option for the entry
 * "requestHandler". Instead of providing an instance of a requestHandler, the user
 * may provide the requestHandler's constructor options for either the
 * NodeHttpHandler or FetchHttpHandler.
 *
 * For other RequestHandlers, constructor parameter passthrough is not available.
 *
 * @public
 */
export type RequestHandlerParams = NodeHttpHandlerOptions | FetchHttpHandlerOptions;

/**
 * Copy of the options in @smithy/node-http-handler NodeHttpHandler class.
 * Not imported due to dependency ordering.
 */
export interface NodeHttpHandlerOptions {
  connectionTimeout?: number;
  requestTimeout?: number;
  httpAgent?: hAgent;
  httpsAgent?: hsAgent;
}

/**
 * Copy of the options in @smithy/fetch-http-handler FetchHttpHandler class.
 * Not imported due to dependency ordering.
 */
export interface FetchHttpHandlerOptions {
  requestTimeout?: number;
  keepAlive?: boolean;
}
