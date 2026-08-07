/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { MetricsRecorderFactory, SerdeContext } from "@smithy/types";

import type { ServiceException } from "./validation/errors";
import type { AuthScheme, ServerInterceptor } from "./interceptors/types";

export { HttpBindingMux, UriSpec } from "./httpbinding/mux";
export type {
  PathLiteralSegment,
  PathLabelSegment,
  GreedySegment,
  QueryLiteralSegment,
  QuerySegment,
} from "./httpbinding/mux";

import * as httpbindingModule from "./httpbinding/mux";

/**
 * Namespace re-export for backward compatibility with generated SSDK code.
 * @public
 */
export const httpbinding: typeof httpbindingModule = httpbindingModule;

export { acceptMatches } from "./validation/accept";

export {
  ServiceException,
  InternalFailureException,
  UnknownOperationException,
  SerializationException,
  UnsupportedMediaTypeException,
  NotAcceptableException,
  UnauthenticatedException,
  isFrameworkException,
} from "./validation/errors";
export type { SmithyFrameworkException } from "./validation/errors";

export { recordSafely, recordTimed, recordTimedSync } from "./metrics/metrics";

export type {
  AuthHook,
  AuthScheme,
  Caller,
  ExecutionHook,
  FrameworkSteps,
  InputHook,
  OutputHook,
  RequestHook,
  ResponseHook,
  ServerInterceptor,
} from "./interceptors/types";

export {
  CompositeValidator,
  CompositeStructureValidator,
  CompositeCollectionValidator,
  CompositeMapValidator,
  NoOpValidator,
  SensitiveConstraintValidator,
  EnumValidator,
  IntegerEnumValidator,
  LengthValidator,
  RangeValidator,
  PatternValidator,
  RequiredValidator,
  UniqueItemsValidator,
} from "./validation/validators";
export { RequiredValidationFailure } from "./validation/types";
export { generateValidationSummary, generateValidationMessage } from "./validation/generateValidationMessage";
export type {
  EnumValidationFailure,
  IntegerEnumValidationFailure,
  LengthValidationFailure,
  PatternValidationFailure,
  RangeValidationFailure,
  UniqueItemsValidationFailure,
  ValidationFailure,
  ValidationContext,
  ValidationCustomizer,
} from "./validation/types";
export type { MultiConstraintValidator, SingleConstraintValidator } from "./validation/validators";

export { findDuplicates } from "./validation/unique";
export type { Input } from "./validation/unique";

export type { ServerProtocol } from "./protocols-schema/layer-0-interface-and-base/ServerProtocol";
export {
  HttpServerProtocol,
  SerdeContextConfig,
} from "./protocols-schema/layer-0-interface-and-base/HttpServerProtocol";
export { RestServerProtocol } from "./protocols-schema/layer-1-abstracts/RestServerProtocol";
export { RpcServerProtocol } from "./protocols-schema/layer-1-abstracts/RpcServerProtocol";
export { SmithyRpcV2CborServerProtocol } from "./protocols-schema/layer-2-protocols/SmithyRpcV2CborServerProtocol";
export { AwsRestJsonServerProtocol } from "./protocols-schema/layer-2-protocols/AwsRestJsonServerProtocol";
export { AwsJsonRpcServerProtocol } from "./protocols-schema/layer-2-protocols/AwsJsonRpcServerProtocol";
export type { AwsJsonRpcServerProtocolOptions } from "./protocols-schema/layer-2-protocols/AwsJsonRpcServerProtocol";

export type Operation<I, O, Context = {}> = (input: I, context: Context) => Promise<O>;

export type OperationInput<T> = T extends Operation<infer I, any, any> ? I : never;
export type OperationOutput<T> = T extends Operation<any, infer O, any> ? O : never;

export interface OperationSerializer<T, K extends keyof T, E extends ServiceException> {
  serialize(input: OperationOutput<T[K]>, ctx: ServerSerdeContext): Promise<HttpResponse>;
  deserialize(input: HttpRequest, ctx: SerdeContext): Promise<OperationInput<T[K]>>;
  isOperationError(error: any): error is E;
  serializeError(error: E, ctx: ServerSerdeContext): Promise<HttpResponse>;
}

export interface ServiceHandler<Context = {}, RequestType = HttpRequest, ResponseType = HttpResponse> {
  handle(request: RequestType, context: Context): Promise<ResponseType>;

  /**
   * Register a metrics recorder factory. The framework creates one recorder per request and
   * records the request lifecycle and phase timings into it.
   */
  withMetrics<Native>(metricsRecorderFactory: MetricsRecorderFactory<Native>): this;

  /**
   * Register auth schemes.
   */
  withAuth(...schemes: AuthScheme<Context>[]): this;

  /**
   * Register a single interceptor. Later registrations run before earlier ones.
   */
  addInterceptor(interceptor: ServerInterceptor<Context>): this;

  /**
   * Register multiple interceptors. Later registrations run before earlier ones.
   */
  addInterceptors(...interceptors: ServerInterceptor<Context>[]): this;
}

export interface ServiceCoordinate<S extends string, O extends string> {
  readonly service: S;
  readonly operation: O;
}
export interface Mux<S extends string, O extends string> {
  match(req: HttpRequest): ServiceCoordinate<S, O> | undefined;
}

export interface ServerSerdeContext extends Omit<SerdeContext, "endpoint"> {}

export type { RouterFunction, RouteResult } from "./service-handler/routing";
export { type SchemaServiceHandlerOptions, SchemaServiceHandler } from "./service-handler/SchemaServiceHandler";
export type { RequestMetadata, ServerRequestContext } from "./service-handler/SchemaServiceHandler";
