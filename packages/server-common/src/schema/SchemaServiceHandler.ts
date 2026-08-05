/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { MetricsRecorderFactory, StaticOperationSchema } from "@smithy/types";

import { InternalFailureException } from "../errors";
import { isFrameworkException } from "../errors";
import { ServiceException } from "../errors";
import { UnknownOperationException } from "../errors";
import type { AuthScheme, Caller, ServerInterceptor } from "../interceptors";
import type { ServerProtocol } from "../protocols-schema/layer-0-interface-and-base/ServerProtocol";
import { createDefaultSerdeContext } from "../serdeContext";
import { validateServerSchema } from "../validation/validateServerSchema";

/**
 * Routes an incoming request to an operation name.
 * Returns `undefined` if the request does not match any known operation.
 *
 * @public
 */
export type RouterFunction = (
  request: HttpRequest,
  operationSchemas: Record<string, StaticOperationSchema>
) => string | undefined;

/**
 * Construction options for {@link SchemaServiceHandler}.
 *
 * @public
 */
export interface SchemaServiceHandlerOptions<Context> {
  /**
   * Protocol instances for request deserialization and response serialization.
   * The handler resolves the appropriate protocol per-request based on headers.
   */
  protocols: ServerProtocol<HttpRequest, HttpResponse>[];

  /**
   * Operation handler implementations keyed by operation name.
   */
  handlers: Record<string, (input: any, context: Context) => Promise<any>>;

  /**
   * Custom router. When omitted the handler uses {@link defaultRouter},
   * which matches RPC-style paths like `/service/{ns}/operation/{op}`.
   */
  router?: RouterFunction;
}

/**
 * Default RPC-style router. Extracts the operation name from URL paths
 * matching `/service/{service}/operation/{operation}`.
 *
 * @public
 */
export function defaultRouter(
  request: HttpRequest,
  operationSchemas: Record<string, StaticOperationSchema>
): string | undefined {
  const match = RPC_ROUTE_RE.exec(request.path);
  if (match) {
    const opName = match[1];
    if (opName in operationSchemas) {
      return opName;
    }
  }
  return undefined;
}

const RPC_ROUTE_RE = /\/service\/[^/]+\/operation\/([^/?]+)/;

/**
 * Base class for schema-based service handlers.
 *
 * Generated handler subclasses extend this to supply typed constructor
 * signatures and operation schemas. The base class provides the request
 * pipeline: protocol resolution, routing, auth, deserialization, validation,
 * invocation, serialization, interceptors, and metrics.
 *
 * @example
 * ```ts
 * const handler = new MyServiceHandler({
 *   protocols: [new SmithyRpcV2CborServerProtocol(...)],
 *   handlers: { MyOp: async (input, ctx) => ({ ... }) },
 * });
 * handler.withMetrics(myFactory).addInterceptor(myInterceptor);
 * const response = await handler.handle(request, {});
 * ```
 *
 * @public
 */
export abstract class SchemaServiceHandler<Context = {}> {
  private router: RouterFunction;
  private readonly protocols: ServerProtocol<HttpRequest, HttpResponse>[];
  private readonly handlers: Record<string, (input: any, context: Context) => Promise<any>>;
  private interceptors: ServerInterceptor<Context>[] = [];
  private authSchemes: AuthScheme<Context>[] = [];
  private metricsRecorderFactory?: MetricsRecorderFactory<any>;

  public constructor(options: SchemaServiceHandlerOptions<Context>) {
    this.protocols = options.protocols;
    this.handlers = options.handlers;
    this.router = options.router ?? defaultRouter;
  }

  /**
   * Handles an incoming HTTP request through the full pipeline:
   * route → authenticate → deserialize → validate → invoke → serialize.
   *
   * @public
   */
  public async handle(request: HttpRequest, context: Context): Promise<HttpResponse> {
    const operationSchemas = this.getOperationSchemas();
    const protocol = this.resolveProtocol(request);
    const serdeContext = createDefaultSerdeContext();
    protocol.setSerdeContext(serdeContext);

    for (let i = 0; i < this.interceptors.length; ++i) {
      this.interceptors[i].readBeforeExecution?.({ request, context });
    }

    const operationName = this.router(request, operationSchemas);
    if (!operationName) {
      return protocol.serializeResponse(
        operationSchemas[Object.keys(operationSchemas)[0]],
        serdeContext,
        new UnknownOperationException() as any
      );
    }

    const operationSchema = operationSchemas[operationName];
    const handler = this.handlers[operationName];

    try {
      // Authenticate
      if (this.authSchemes.length > 0) {
        let caller: Caller | undefined;
        for (let i = 0; i < this.authSchemes.length; ++i) {
          caller = (await this.authSchemes[i].authenticate(request, context)) ?? undefined;
          if (caller) {
            break;
          }
        }
      }

      // Deserialize
      const input = await protocol.deserializeRequest(operationSchema, serdeContext, request);

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readAfterDeserialization?.({ request, context, operation: operationName, input });
      }

      // Validate
      if (this.isValidationEnabled()) {
        const inputSchema = operationSchema[4];
        if (inputSchema) {
          const errors = validateServerSchema(inputSchema, input);
          if (errors.length > 0) {
            throw new ServiceException({
              name: "ValidationException",
              $fault: "client",
              message: errors.join("; "),
            });
          }
        }
      }

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readBeforeInvocation?.({ request, context, operation: operationName, input });
      }

      // Invoke
      const output = await handler(input, context);

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readAfterInvocation?.({ request, context, operation: operationName, input, output });
      }

      // Serialize
      return protocol.serializeResponse(operationSchema, serdeContext, output);
    } catch (error: any) {
      if (isFrameworkException(error)) {
        return protocol.serializeResponse(operationSchema, serdeContext, error as any);
      }
      if (error instanceof ServiceException) {
        return protocol.serializeResponse(operationSchema, serdeContext, error as any);
      }
      return protocol.serializeResponse(operationSchema, serdeContext, new InternalFailureException() as any);
    }
  }

  /**
   * Register a metrics recorder factory. The framework creates one recorder
   * per request and records lifecycle timings.
   *
   * @public
   */
  public withMetrics<Native>(metricsRecorderFactory: MetricsRecorderFactory<Native>): this {
    this.metricsRecorderFactory = metricsRecorderFactory;
    return this;
  }

  /**
   * Register auth schemes. Schemes are tried in registration order; the first
   * to return a non-null {@link Caller} wins.
   *
   * @public
   */
  public withAuth(...schemes: AuthScheme<Context>[]): this {
    this.authSchemes.push(...schemes);
    return this;
  }

  /**
   * Register a single interceptor. Later registrations run before earlier ones.
   *
   * @public
   */
  public addInterceptor(interceptor: ServerInterceptor<Context>): this {
    this.interceptors.unshift(interceptor);
    return this;
  }

  /**
   * Register multiple interceptors. Later registrations run before earlier ones.
   *
   * @public
   */
  public addInterceptors(...interceptors: ServerInterceptor<Context>[]): this {
    this.interceptors.unshift(...[...interceptors].reverse());
    return this;
  }

  /**
   * Replace the router with a custom implementation.
   *
   * @public
   */
  public withRouter(router: RouterFunction): this {
    this.router = router;
    return this;
  }

  /**
   * Returns the operation schemas for this service.
   * Generated subclasses implement this to provide the static schema map.
   *
   * @internal
   */
  protected abstract getOperationSchemas(): Record<string, StaticOperationSchema>;

  /**
   * Whether input validation is enabled. Generated subclasses override this
   * to return `false` when `disableDefaultValidation` is set.
   *
   * @internal
   */
  protected isValidationEnabled(): boolean {
    return true;
  }

  /**
   * Resolves the protocol to use for a given request based on headers.
   * When only one protocol is registered it is used unconditionally.
   */
  private resolveProtocol(request: HttpRequest): ServerProtocol<HttpRequest, HttpResponse> {
    if (this.protocols.length === 1) {
      return this.protocols[0];
    }

    const headers = request.headers;
    let smithyProtocolValue: string | undefined;
    let contentTypeValue: string | undefined;

    for (const key in headers) {
      const lower = key.toLowerCase();
      if (lower === "smithy-protocol") {
        smithyProtocolValue = headers[key];
      } else if (lower === "content-type") {
        contentTypeValue = headers[key];
      }
    }

    for (let i = 0; i < this.protocols.length; ++i) {
      const protocol = this.protocols[i];
      const shapeId = protocol.getShapeId();
      if (shapeId === "smithy.protocols#rpcv2Cbor" && smithyProtocolValue === "rpc-v2-cbor") {
        return protocol;
      }
      if (contentTypeValue === "application/json" && shapeId.includes("restJson")) {
        return protocol;
      }
    }

    throw new Error("UnsupportedMediaType: no registered protocol matches the request.");
  }
}
