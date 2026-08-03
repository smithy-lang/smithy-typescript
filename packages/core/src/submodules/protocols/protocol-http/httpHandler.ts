import type { HttpRequest, HttpResponse } from "@smithy/core/transport";
import type {
  FetchHttpHandlerOptions,
  HttpHandlerOptions,
  Logger,
  NodeHttpHandlerOptions,
  RequestHandler,
} from "@smithy/types";

import type { FALLBACK_LOGGER } from "./fallbackLogger";

/**
 * @internal
 */
export type HttpHandler<HttpHandlerConfig extends object = {}> = RequestHandler<
  HttpRequest,
  HttpResponse,
  HttpHandlerOptions
> & {
  /**
   * @internal
   *
   * The key may also be {@link FALLBACK_LOGGER}, with which a client offers its
   * logger for use only when the handler has no logger of its own. Handlers
   * that predate that key ignore it.
   */
  updateHttpClientConfig(
    key: keyof HttpHandlerConfig | typeof FALLBACK_LOGGER,
    value: HttpHandlerConfig[keyof HttpHandlerConfig] | Logger
  ): void;

  /**
   * @internal
   */
  httpHandlerConfigs(): HttpHandlerConfig;
};

/**
 * A type representing the accepted user inputs for the `requestHandler` field
 * of a client's constructor object.
 * You may provide an instance of an HttpHandler, or alternatively
 * provide the constructor arguments as an object which will be passed
 * to the constructor of the default request handler.
 * The default class constructor to which your arguments will be passed
 * varies. The Node.js default is the NodeHttpHandler and the browser/react-native
 * default is the FetchHttpHandler. In rarer cases specific clients may be
 * configured to use other default implementations such as Websocket or HTTP2.
 * The fallback type Record<string, unknown> is part of the union to allow
 * passing constructor params to an unknown requestHandler type.
 *
 * @public
 */
export type HttpHandlerUserInput =
  | HttpHandler
  | NodeHttpHandlerOptions
  | FetchHttpHandlerOptions
  | Record<string, unknown>;
