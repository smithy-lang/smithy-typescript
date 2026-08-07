/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { MetricsRecorderFactory, StaticOperationSchema, Logger } from "@smithy/types";

import { InternalFailureException } from "../validation/errors";
import { isFrameworkException } from "../validation/errors";
import { ServiceException } from "../validation/errors";
import { UnknownOperationException } from "../validation/errors";
import { UnauthenticatedException } from "../validation/errors";
import type { AuthScheme, Caller, ServerInterceptor } from "../interceptors/types";
import type { ServerProtocol } from "../protocols-schema/layer-0-interface-and-base/ServerProtocol";
import { recordSafely, recordTimed, recordTimedSync } from "../metrics/metrics";
import { createDefaultSerdeContext } from "./serdeContext";
import { validateServerSchema } from "../validation/validateServerSchema";
import { createCombinedRouter } from "./routing";
import type { RouterFunction } from "./routing";
import { NoOpLogger } from "@smithy/core/client";
import type { QueryParameterBag } from "@smithy/types";

/**
 * Non-body components of the HTTP request, available to handlers.
 * The body is excluded because it has already been consumed during deserialization.
 *
 * @public
 */
export interface RequestMetadata {
  readonly method: string;
  readonly path: string;
  readonly query?: QueryParameterBag;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Framework-provided context merged into the handler's second argument.
 * Contains request metadata, the resolved operation name, and the authenticated
 * caller identity (if auth schemes are configured).
 *
 * @public
 */
export interface ServerRequestContext {
  readonly request: RequestMetadata;
  readonly operation: string;
  readonly caller?: Caller;
}

/**
 * Construction options for {@link SchemaServiceHandler}.
 *
 * @public
 */
export interface SchemaServiceHandlerOptions<Context = {}> {
  /**
   * Protocol instances for request deserialization and response serialization.
   * The handler resolves the appropriate protocol per-request based on headers.
   */
  protocols: ServerProtocol<HttpRequest, HttpResponse>[];

  /**
   * Operation handler implementations keyed by operation name.
   */
  handlers: Record<string, (input: any, context: ServerRequestContext, userContext: Context) => Promise<any>>;

  /**
   * Operation schemas for request routing, serde, and validation.
   * The handler derives the operation name from each schema (index 2 of the tuple).
   *
   * @defaultValue []
   */
  operationSchemas?: StaticOperationSchema[];

  /**
   * Whether input validation is enabled. When `true` (the default), the
   * handler validates deserialized input against schema constraints before
   * invoking the operation handler.
   *
   * @defaultValue true
   */
  validationEnabled?: boolean;

  /**
   * Custom router. When omitted the handler uses {@link combinedRouter},
   * which matches RPC-style paths like `/service/{ns}/operation/{op}`.
   */
  router?: RouterFunction;

  logger?: Logger;

  /**
   * Called when the framework is about to produce an error response — from
   * validation failures, auth rejection, or unhandled handler exceptions.
   *
   * Return a `ServiceException` to replace the error the framework would
   * otherwise serialize. Return `undefined` to suppress the error entirely
   * (the pipeline continues as if no error occurred — only meaningful for
   * validation, where suppression allows the handler to run with invalid input).
   *
   * @param operation - The operation name, or undefined if routing failed.
   * @param error - The error that was produced (e.g. ValidationException,
   *   UnauthenticatedException, or a handler-thrown error).
   */
  onError?: (operation: string | undefined, error: unknown) => ServiceException | undefined;
}

/**
 * Schema-based service handler.
 *
 * Provides the full request pipeline: protocol resolution, routing, auth,
 * deserialization, validation, invocation, serialization, interceptors, and
 * metrics. Can be instantiated directly or extended by generated subclasses
 * that supply typed constructor signatures.
 *
 * @example
 * ```ts
 * const handler = new SchemaServiceHandler({
 *   protocols: [new SmithyRpcV2CborServerProtocol(...)],
 *   operationSchemas: { MyOp: MyOp$ },
 *   handlers: { MyOp: async (input, ctx) => ({ ... }) },
 * });
 * handler.withMetrics(myFactory).addInterceptor(myInterceptor);
 * const response = await handler.handle(request, {});
 * ```
 *
 * @public
 */
export class SchemaServiceHandler<Context = {}> {
  private router: RouterFunction;
  private readonly protocols: Record<string, ServerProtocol<HttpRequest, HttpResponse>>;
  private readonly operationSchemas: Record<string, StaticOperationSchema>;
  private readonly handlers: Record<
    string,
    (input: any, context: ServerRequestContext, userContext: Context) => Promise<any>
  >;
  private readonly validationEnabled: boolean;
  private interceptors: ServerInterceptor<Context>[] = [];
  private authSchemes: AuthScheme<Context>[] = [];
  private metricsRecorderFactory?: MetricsRecorderFactory<any>;
  private logger: Logger;
  private onError?: (operation: string | undefined, error: unknown) => ServiceException | undefined;

  public constructor(options: SchemaServiceHandlerOptions<Context>) {
    this.protocols = {};
    for (const protocol of options.protocols) {
      this.protocols[protocol.getShapeId()] = protocol;
    }
    this.operationSchemas = {};
    for (const schema of options.operationSchemas ?? []) {
      this.operationSchemas[schema[2]] = schema;
    }
    this.handlers = { ...options.handlers };
    this.validationEnabled = options.validationEnabled ?? true;
    this.router = options.router ?? createCombinedRouter(this.protocols);
    this.logger = options.logger ?? new NoOpLogger();
    this.onError = options.onError;

    // Validate that every operation schema has a corresponding handler.
    const schemaKeys = Object.keys(this.operationSchemas);
    const handlerKeys = Object.keys(this.handlers);
    const missingHandlers = schemaKeys.filter((op) => !(op in this.handlers));
    const orphanHandlers = handlerKeys.filter((op) => !(op in this.operationSchemas));
    if (missingHandlers.length > 0) {
      throw new Error(
        `@smithy/server-common::SchemaServiceHandler: the following operations are missing handlers: ${missingHandlers.join(", ")}`
      );
    }
    if (orphanHandlers.length > 0) {
      throw new Error(
        `@smithy/server-common::SchemaServiceHandler: the following handlers have no corresponding operation schema: ${orphanHandlers.join(", ")}`
      );
    }
  }

  /**
   * Handles an incoming HTTP request through the full pipeline:
   * route → authenticate → deserialize → validate → invoke → serialize.
   */
  public async handle(request: HttpRequest, context: Context): Promise<HttpResponse> {
    const operationSchemas = this.operationSchemas;
    const routeResult = this.router(request, this.protocols, operationSchemas, this.logger);

    if (!routeResult) {
      return new HttpResponse({
        statusCode: 400,
        body: `Malformed request`,
      });
    }

    const { protocol, operationName } = routeResult;
    const serdeContext = createDefaultSerdeContext();
    protocol.setSerdeContext(serdeContext);

    // Create a per-request metrics recorder if a factory is registered.
    const recorder = this.metricsRecorderFactory?.create();
    recordSafely(recorder, (r) => r.begin());
    const requestStart = performance.now();

    for (let i = 0; i < this.interceptors.length; ++i) {
      this.interceptors[i].readBeforeExecution?.({ request, context });
    }

    if (!operationName) {
      const response = await protocol.serializeResponse(
        operationSchemas[Object.keys(operationSchemas)[0]],
        serdeContext,
        new UnknownOperationException() as any
      );
      recordSafely(recorder, (r) => {
        r.recordRequestOutcome("Fault", performance.now() - requestStart);
        r.end();
      });
      return response;
    }

    const operationSchema = operationSchemas[operationName];
    const handler = this.handlers[operationName];

    try {
      // Authenticate
      let caller: Caller | undefined;
      if (this.authSchemes.length > 0) {
        caller = await recordTimed(recorder, "Authenticate", async () => {
          for (let i = 0; i < this.authSchemes.length; ++i) {
            const result = (await this.authSchemes[i].authenticate(request, context)) ?? undefined;
            if (result) {
              return result;
            }
          }
          throw new UnauthenticatedException();
        });
      }

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readAfterAuthentication?.({
          request,
          context,
          authScheme: caller ? "authenticated" : "",
          caller: caller ?? { principal: "" },
        });
      }

      // modifyBeforeDeserialization — interceptors can replace the request.
      let currentRequest = request;
      for (let i = 0; i < this.interceptors.length; ++i) {
        const modified = this.interceptors[i].modifyBeforeDeserialization?.({ request: currentRequest, context });
        if (modified) {
          currentRequest = modified;
        }
      }

      // Deserialize
      let input: any = await recordTimed(recorder, "Deserialize", () =>
        protocol.deserializeRequest(operationSchema, serdeContext, currentRequest)
      );

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readAfterDeserialization?.({
          request: currentRequest,
          context,
          operation: operationName,
          input,
        });
      }

      // modifyBeforeValidation — interceptors can replace the input.
      for (let i = 0; i < this.interceptors.length; ++i) {
        const modified = this.interceptors[i].modifyBeforeValidation?.({
          request: currentRequest,
          context,
          operation: operationName,
          input,
        });
        if (modified !== undefined) {
          input = modified;
        }
      }

      // Validate
      if (this.validationEnabled) {
        recordTimedSync(recorder, "Validate", () => {
          const inputSchema = operationSchema[4];
          if (inputSchema) {
            const errors = validateServerSchema(inputSchema, input);
            if (errors.length > 0) {
              const validationError = new ServiceException({
                name: "ValidationException",
                $fault: "client",
                message: errors.join("; "),
              });
              if (this.onError) {
                const replacement = this.onError(operationName, validationError);
                if (replacement) {
                  throw replacement;
                }
                // undefined = suppress, continue to handler
              } else {
                throw validationError;
              }
            }
          }
        });
      }

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readBeforeInvocation?.({
          request: currentRequest,
          context,
          operation: operationName,
          input,
        });
      }

      // Invoke
      const requestContext: ServerRequestContext = {
        request: {
          method: request.method,
          path: request.path,
          query: request.query,
          headers: request.headers,
        },
        operation: operationName,
        caller,
      };
      const output = await recordTimed(recorder, "Invoke", () => handler(input, requestContext, context));

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readAfterInvocation?.({
          request: currentRequest,
          context,
          operation: operationName,
          input,
          output,
        });
      }

      // modifyBeforeSerialization — interceptors can replace the output.
      let currentOutput = output;
      for (let i = 0; i < this.interceptors.length; ++i) {
        const modified = this.interceptors[i].modifyBeforeSerialization?.({
          request: currentRequest,
          context,
          operation: operationName,
          input,
          output: currentOutput,
        });
        if (modified !== undefined) {
          currentOutput = modified;
        }
      }

      // Serialize
      let response = await recordTimed(recorder, "Serialize", () =>
        protocol.serializeResponse(operationSchema, serdeContext, currentOutput)
      );

      // modifyBeforeCompletion — interceptors can replace the response.
      for (let i = 0; i < this.interceptors.length; ++i) {
        const modified = this.interceptors[i].modifyBeforeCompletion?.({
          request: currentRequest,
          context,
          operation: operationName,
          input,
          output: currentOutput,
          response,
        });
        if (modified) {
          response = modified;
        }
      }

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readAfterSerialization?.({
          request: currentRequest,
          context,
          operation: operationName,
          input,
          output: currentOutput,
          response,
        });
      }

      recordSafely(recorder, (r) => {
        r.recordRequestOutcome("Success", performance.now() - requestStart);
        r.end();
      });

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readAfterExecution?.({
          request: currentRequest,
          context,
          operation: operationName,
          input,
          output,
          response,
        });
      }

      return response;
    } catch (error: any) {
      // Consult onError hook — it can replace the error or return undefined to use default handling.
      const effectiveError = this.onError ? (this.onError(operationName, error) ?? error) : error;

      let response: HttpResponse;
      if (isFrameworkException(effectiveError)) {
        response = await protocol.serializeResponse(operationSchema, serdeContext, effectiveError as any);
      } else if (effectiveError instanceof ServiceException) {
        response = await protocol.serializeResponse(operationSchema, serdeContext, effectiveError as any);
      } else {
        response = await protocol.serializeResponse(
          operationSchema,
          serdeContext,
          new InternalFailureException() as any
        );
      }

      recordSafely(recorder, (r) => {
        r.recordRequestOutcome("Fault", performance.now() - requestStart);
        r.end();
      });

      for (let i = 0; i < this.interceptors.length; ++i) {
        this.interceptors[i].readAfterExecution?.({
          request,
          context,
          operation: operationName,
          error: effectiveError,
        });
      }

      return response;
    }
  }

  /**
   * Register a metrics recorder factory. The framework creates one recorder
   * per request and records lifecycle timings.
   */
  public withMetrics<Native>(metricsRecorderFactory: MetricsRecorderFactory<Native>): this {
    this.metricsRecorderFactory = metricsRecorderFactory;
    return this;
  }

  /**
   * Register auth schemes. Schemes are tried in registration order; the first
   * to return a non-null {@link Caller} wins.
   */
  public withAuth(...schemes: AuthScheme<Context>[]): this {
    this.authSchemes.push(...schemes);
    return this;
  }

  /**
   * Register a single interceptor. Later registrations run before earlier ones.
   */
  public addInterceptor(interceptor: ServerInterceptor<Context>): this {
    this.interceptors.unshift(interceptor);
    return this;
  }

  /**
   * Register multiple interceptors. Later registrations run before earlier ones.
   */
  public addInterceptors(...interceptors: ServerInterceptor<Context>[]): this {
    this.interceptors.unshift(...[...interceptors].reverse());
    return this;
  }

  /**
   * Replace the router with a custom implementation.
   */
  public withRouter(router: RouterFunction): this {
    this.router = router;
    return this;
  }

  /**
   * Dynamically register an operation schema and its handler.
   * Throws if an operation with the same name is already registered.
   */
  public addOperation(
    schema: StaticOperationSchema,
    handler: (input: any, context: ServerRequestContext, userContext: Context) => Promise<any>
  ): this {
    const operationName = schema[2];
    if (operationName in this.operationSchemas) {
      throw new Error(`SchemaServiceHandler: operation "${operationName}" is already registered.`);
    }
    this.operationSchemas[operationName] = schema;
    this.handlers[operationName] = handler;
    return this;
  }
}
