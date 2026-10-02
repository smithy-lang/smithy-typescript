/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { NoOpLogger } from "@smithy/core/client";
import { type HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { Logger, MetricsRecorderFactory, StaticOperationSchema } from "@smithy/types";
import { hasOwn } from "@smithy/core/serde";

import type { IdentityCaller, RequestIdentity } from "../identity";
import type { AuthScheme, ServerInterceptor } from "../interceptors/types";
import { recordSafely, recordTimed, recordTimedSync } from "../metrics/metrics";
import type { ServerProtocol } from "../protocols-schema/layer-0-interface-and-base/ServerProtocol";
import {
  InternalFailureException,
  isFrameworkException,
  ServiceException,
  UnauthenticatedException,
  UnknownOperationException,
  ValidationException,
} from "../validation/errors";
import { validateServerSchema } from "../validation/validateServerSchema";
import { createCombinedRouter } from "./routing";
import type { RouterFunction } from "./routing";
import { createDefaultSerdeContext } from "./serdeContext";
import type {
  ReadonlyUserAttributes,
  ServerOperation,
  ServerOperationContext,
  ServerRequest,
  UserAttributeKey,
} from "./types";

/**
 * Construction options for {@link SchemaServiceHandler}.
 *
 * @public
 */
export interface SchemaServiceHandlerOptions<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> {
  /**
   * Protocols in request-claiming priority order.
   */
  readonly protocols: readonly ServerProtocol<HttpRequest, HttpResponse>[];

  /**
   * Operation handler implementations keyed by operation name.
   */
  readonly handlers: Readonly<Record<string, ServerOperation<any, any, Identity, MetricsNative>>>;

  /**
   * Generated operation schemas used for routing, serde, and validation.
   */
  readonly operationSchemas: readonly StaticOperationSchema[];

  /**
   * Whether input validation is enabled.
   *
   * @defaultValue true
   */
  readonly validationEnabled?: boolean;

  /**
   * Per-request metrics recorder factory.
   */
  readonly metricsRecorderFactory?: MetricsRecorderFactory<MetricsNative>;

  /**
   * Authentication schemes in first-success order.
   */
  readonly authSchemes?: readonly AuthScheme<Identity>[];

  /**
   * Interceptors in registration order. Later entries run first.
   */
  readonly interceptors?: readonly ServerInterceptor<Identity, MetricsNative>[];

  readonly logger?: Logger;

  /**
   * Called before an error response is serialized.
   *
   * Returning a ServiceException replaces the error. During validation,
   * returning undefined suppresses the validation error.
   */
  readonly onError?: (operation: string | undefined, error: unknown) => ServiceException | undefined;
}

type MetricsErrorClass = "Error" | "Fault" | "Failure";

class ReadonlyMapSnapshot<K, V> implements ReadonlyMap<K, V> {
  readonly #entries: Map<K, V>;

  public constructor(entries: ReadonlyMap<K, V>) {
    this.#entries = new Map(entries);
    Object.freeze(this);
  }

  public get size(): number {
    return this.#entries.size;
  }

  public get(key: K): V | undefined {
    return this.#entries.get(key);
  }

  public has(key: K): boolean {
    return this.#entries.has(key);
  }

  public forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: any): void {
    this.#entries.forEach((value, key) => callbackfn.call(thisArg, value, key, this));
  }

  public entries(): MapIterator<[K, V]> {
    return this.#entries.entries();
  }

  public keys(): MapIterator<K> {
    return this.#entries.keys();
  }

  public values(): MapIterator<V> {
    return this.#entries.values();
  }

  public [Symbol.iterator](): MapIterator<[K, V]> {
    return this.#entries[Symbol.iterator]();
  }
}

/**
 * Shared schema-based server request pipeline.
 *
 * @public
 */
export class SchemaServiceHandler<Identity extends RequestIdentity = RequestIdentity, MetricsNative = unknown> {
  private readonly protocols: readonly ServerProtocol<HttpRequest, HttpResponse>[];
  private readonly operationSchemas: Readonly<Record<string, StaticOperationSchema>>;
  private readonly handlers: Readonly<Record<string, ServerOperation<any, any, Identity, MetricsNative>>>;
  private readonly validationEnabled: boolean;
  private readonly interceptors: readonly ServerInterceptor<Identity, MetricsNative>[];
  private readonly authSchemes: readonly AuthScheme<Identity>[];
  private readonly metricsRecorderFactory?: MetricsRecorderFactory<MetricsNative>;
  private readonly router: RouterFunction;
  private readonly logger: Logger;
  private readonly onError?: (operation: string | undefined, error: unknown) => ServiceException | undefined;

  public constructor(options: SchemaServiceHandlerOptions<Identity, MetricsNative>) {
    if (options.protocols.length === 0) {
      throw new Error("@smithy/server-common::SchemaServiceHandler: at least one protocol is required.");
    }

    const protocolIds = new Set<string>();
    const duplicateProtocolIds = new Set<string>();
    for (const protocol of options.protocols) {
      const protocolId = protocol.getShapeId();
      if (protocolIds.has(protocolId)) {
        duplicateProtocolIds.add(protocolId);
      }
      protocolIds.add(protocolId);
    }
    if (duplicateProtocolIds.size > 0) {
      throw new Error(
        `@smithy/server-common::SchemaServiceHandler: duplicate protocol IDs: ${[...duplicateProtocolIds].join(", ")}`
      );
    }

    this.protocols = Object.freeze([...options.protocols]);
    const operationSchemas: Record<string, StaticOperationSchema> = Object.create(null);
    for (const schema of options.operationSchemas) {
      operationSchemas[schema[2]] = schema;
    }
    this.operationSchemas = Object.freeze(operationSchemas);
    const handlers = Object.assign(Object.create(null), options.handlers) as Record<
      string,
      ServerOperation<any, any, Identity, MetricsNative>
    >;
    this.handlers = Object.freeze(handlers);
    this.validationEnabled = options.validationEnabled ?? true;
    this.metricsRecorderFactory = options.metricsRecorderFactory;
    this.authSchemes = Object.freeze([...(options.authSchemes ?? [])]);
    this.interceptors = Object.freeze([...(options.interceptors ?? [])].reverse());
    this.router = createCombinedRouter(this.protocols);
    this.logger = options.logger ?? new NoOpLogger();
    this.onError = options.onError;

    const schemaKeys = Object.keys(this.operationSchemas);
    const handlerKeys = Object.keys(this.handlers);
    const missingHandlers = schemaKeys.filter((operation) => !hasOwn(this.handlers, operation));
    const orphanHandlers = handlerKeys.filter((operation) => !hasOwn(this.operationSchemas, operation));

    if (missingHandlers.length > 0) {
      throw new Error(
        `@smithy/server-common::SchemaServiceHandler: the following operations are missing handlers: ${missingHandlers.join(
          ", "
        )}`
      );
    }
    if (orphanHandlers.length > 0) {
      throw new Error(
        `@smithy/server-common::SchemaServiceHandler: the following handlers have no corresponding operation schema: ${orphanHandlers.join(
          ", "
        )}`
      );
    }
  }

  /**
   * Handles a framework-created server request.
   */
  public async handle(serverRequest: ServerRequest<Identity>): Promise<HttpResponse> {
    const frameworkRequest = serverRequest.request as HttpRequest;
    const claimResult = this.router(frameworkRequest, this.logger);
    if (!claimResult) {
      return new HttpResponse({
        statusCode: 400,
        body: "Malformed request",
      });
    }

    const protocol = claimResult.protocol;
    const serdeContext = createDefaultSerdeContext();
    protocol.setSerdeContext(serdeContext);

    const recorder = this.metricsRecorderFactory?.create();
    const userAttributes: ReadonlyUserAttributes = new ReadonlyMapSnapshot<UserAttributeKey, unknown>(
      serverRequest.userAttributes
    );
    let identity = snapshotIdentity(serverRequest.identity);
    let currentRequest = frameworkRequest;
    let operation: string | undefined;
    let input: unknown;
    let output: unknown;
    let response: HttpResponse | undefined;
    let error: unknown;
    let metricsErrorClass: MetricsErrorClass | undefined;
    let validationErrorWasCustomized = false;
    const entered = new Set<ServerInterceptor<Identity, MetricsNative>>();
    const requestStart = performance.now();

    const requestHook = () => ({
      request: frameworkRequest,
      identity,
      metricsRecorder: recorder,
      userAttributes,
    });

    const convertError = async (caught: unknown): Promise<HttpResponse> => {
      const effectiveError =
        validationErrorWasCustomized || !this.onError ? caught : (this.onError(operation, caught) ?? caught);
      validationErrorWasCustomized = false;
      error = effectiveError;
      const operationDefinition = operation ? this.operationSchemas[operation] : undefined;

      if (effectiveError instanceof ServiceException) {
        metricsErrorClass = "Error";
        return this.serializeError(protocol, operationDefinition, effectiveError);
      }

      if (isFrameworkException(effectiveError)) {
        metricsErrorClass = "Fault";
        return this.serializeError(protocol, operationDefinition, effectiveError);
      }

      metricsErrorClass = "Failure";
      return this.serializeError(protocol, operationDefinition, new InternalFailureException());
    };

    recordSafely(recorder, (requestRecorder) => requestRecorder.begin());

    const runPipeline = async (): Promise<HttpResponse> => {
      try {
        for (const interceptor of this.interceptors) {
          interceptor.readBeforeExecution?.(requestHook());
          entered.add(interceptor);
        }

        if (this.authSchemes.length > 0) {
          let caller: Readonly<IdentityCaller<Identity>> | undefined;
          let authScheme: string | undefined;
          for (const scheme of this.authSchemes) {
            const result = await scheme.authenticate(currentRequest, identity);
            if (result) {
              caller = result;
              authScheme = scheme.name;
              break;
            }
          }
          if (!caller) {
            throw new UnauthenticatedException();
          }

          identity = addCaller(identity, caller);
          this.fireRead("readAfterAuthentication", () => ({
            ...requestHook(),
            authScheme: authScheme!,
            caller,
          }));
        }

        currentRequest = this.fireModify("modifyBeforeDeserialization", currentRequest, (request) => ({
          ...requestHook(),
          request,
        }));

        const routedOperation = protocol.route(currentRequest, this.operationSchemas, this.logger);
        operation = routedOperation;
        if (!routedOperation) {
          throw new UnknownOperationException();
        }

        const operationDefinition = this.operationSchemas[routedOperation];
        const operationHandler = this.handlers[routedOperation];
        if (!operationDefinition || !operationHandler) {
          throw new UnknownOperationException();
        }

        input = await recordTimed(recorder, "DeserializationTime", () =>
          protocol.deserializeRequest(operationDefinition, serdeContext, currentRequest)
        );

        const inputHook = () => ({
          ...requestHook(),
          operation: routedOperation,
          input,
        });
        this.fireRead("readAfterDeserialization", inputHook);

        input = this.fireModify("modifyBeforeValidation", input, (value) => ({
          ...requestHook(),
          operation: routedOperation,
          input: value,
        }));

        if (this.validationEnabled) {
          recordTimedSync(recorder, "ValidationTime", () => {
            const inputSchema = operationDefinition[4];
            if (!inputSchema) {
              return;
            }

            const validationFailures = validateServerSchema(inputSchema, input);
            if (validationFailures.length === 0) {
              return;
            }

            const validationError = new ValidationException(validationFailures.join("; "));
            if (!this.onError) {
              throw validationError;
            }

            const replacement = this.onError(routedOperation, validationError);
            if (replacement) {
              validationErrorWasCustomized = true;
              throw replacement;
            }
          });
        }

        this.fireRead("readAfterValidation", inputHook);
        this.fireRead("readBeforeInvocation", inputHook);

        const operationRequest = Object.freeze({
          request: frameworkRequest,
          identity,
          userAttributes,
        });
        const requestContext: ServerOperationContext<Identity, MetricsNative> = Object.freeze({
          request: operationRequest,
          operation: routedOperation,
          operationDefinition,
          identity,
          metricsRecorder: recorder,
          userAttributes,
        });

        output = await recordTimed(recorder, "ActivityTime", () => operationHandler(input, requestContext));

        this.fireRead("readAfterInvocation", () => ({
          ...inputHook(),
          output,
        }));

        output = this.fireModify("modifyBeforeSerialization", output, (value) => ({
          ...inputHook(),
          output: value,
        }));

        response = await recordTimed(recorder, "SerializationTime", () =>
          protocol.serializeResponse(operationDefinition, serdeContext, output as object)
        );

        this.fireRead("readAfterSerialization", () => ({
          ...inputHook(),
          output,
          response: response!,
        }));
      } catch (caught: unknown) {
        error = caught;
        response = await convertError(caught);
      }

      try {
        response = this.fireModify("modifyBeforeCompletion", response!, (currentResponse) => ({
          ...requestHook(),
          operation: operation!,
          input,
          output,
          response: currentResponse,
        }));
      } catch (caught: unknown) {
        error = caught;
        response = await convertError(caught);
      }

      const executionHook = {
        ...requestHook(),
        operation,
        input,
        output,
        response,
        error,
      };
      for (const interceptor of this.interceptors) {
        if (!entered.has(interceptor) || !interceptor.readAfterExecution) {
          continue;
        }
        try {
          interceptor.readAfterExecution(executionHook);
        } catch {
          // readAfterExecution is best-effort and cannot replace the response.
        }
      }

      return response!;
    };

    try {
      return await runPipeline();
    } finally {
      if (operation) {
        recordSafely(recorder, (requestRecorder) => requestRecorder.setProperty("Operation", operation));
      }
      recordSafely(recorder, (requestRecorder) =>
        requestRecorder.recordRequestOutcome(
          error === undefined ? "Success" : "Fault",
          performance.now() - requestStart
        )
      );
      recordSafely(recorder, (requestRecorder) =>
        requestRecorder.addCount("Error", metricsErrorClass === "Error" ? 1 : 0)
      );
      recordSafely(recorder, (requestRecorder) =>
        requestRecorder.addCount("Fault", metricsErrorClass === "Fault" || metricsErrorClass === "Failure" ? 1 : 0)
      );
      recordSafely(recorder, (requestRecorder) =>
        requestRecorder.addCount("Failure", metricsErrorClass === "Failure" ? 1 : 0)
      );
      recordSafely(recorder, (requestRecorder) => requestRecorder.end());
    }
  }

  private async serializeError(
    protocol: ServerProtocol<HttpRequest, HttpResponse> | undefined,
    operationDefinition: StaticOperationSchema | undefined,
    error: object & { readonly statusCode?: number; readonly name?: string }
  ): Promise<HttpResponse> {
    if (protocol) {
      const schema = operationDefinition ?? Object.values(this.operationSchemas)[0];
      if (schema) {
        return protocol.serializeResponse(schema, createDefaultSerdeContext(), error);
      }
    }

    return new HttpResponse({
      statusCode: error.statusCode ?? 500,
      body: error.name ?? "InternalFailure",
    });
  }

  private fireRead<Hook>(method: keyof ServerInterceptor<Identity, MetricsNative>, buildHook: () => Hook): void {
    for (const interceptor of this.interceptors) {
      const hook = interceptor[method] as ((value: Hook) => void) | undefined;
      hook?.call(interceptor, buildHook());
    }
  }

  private fireModify<Value, Hook>(
    method: keyof ServerInterceptor<Identity, MetricsNative>,
    initial: Value,
    buildHook: (current: Value) => Hook
  ): Value {
    let current = initial;
    for (const interceptor of this.interceptors) {
      const hook = interceptor[method] as ((value: Hook) => Value) | undefined;
      if (hook) {
        current = hook.call(interceptor, buildHook(current));
      }
    }
    return current;
  }
}

function snapshotIdentity<Identity extends RequestIdentity>(identity: Readonly<Identity>): Readonly<Identity> {
  const caller = identity.caller ? Object.freeze({ ...identity.caller }) : undefined;
  return Object.freeze({
    ...identity,
    ...(caller ? { caller } : {}),
  }) as Readonly<Identity>;
}

function addCaller<Identity extends RequestIdentity>(
  identity: Readonly<Identity>,
  caller: Readonly<IdentityCaller<Identity>>
): Readonly<Identity> {
  return Object.freeze({
    ...identity,
    caller: Object.freeze({ ...caller }),
  }) as Readonly<Identity>;
}
