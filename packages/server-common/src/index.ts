import type { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { MetricsRecorderFactory, SerdeContext } from "@smithy/types";

import type { ServiceException } from "./errors";
import type { AuthScheme, ServerInterceptor } from "./interceptors";

/*
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *   http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

export { HttpBindingMux, UriSpec } from "./httpbinding/mux";
export type {
  PathLiteralSegment,
  PathLabelSegment,
  GreedySegment,
  QueryLiteralSegment,
  QuerySegment,
} from "./httpbinding/mux";

import * as httpbindingModule from "./httpbinding";

/**
 * Namespace re-export for backward compatibility with generated SSDK code.
 * @public
 */
export const httpbinding: typeof httpbindingModule = httpbindingModule;

export { acceptMatches } from "./accept";

export {
  ServiceException,
  InternalFailureException,
  UnknownOperationException,
  SerializationException,
  UnsupportedMediaTypeException,
  NotAcceptableException,
  UnauthenticatedException,
  isFrameworkException,
} from "./errors";
export type { SmithyFrameworkException } from "./errors";

export { recordSafely, recordTimed, recordTimedSync } from "./metrics";

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
} from "./interceptors";

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
  RequiredValidationFailure,
  generateValidationSummary,
  generateValidationMessage,
} from "./validation";
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
  MultiConstraintValidator,
  SingleConstraintValidator,
} from "./validation";

export { findDuplicates } from "./unique";
export type { Input } from "./unique";

export type { ServerProtocol } from "./protocols-schema/layer-0-interface-and-base/ServerProtocol";
export {
  HttpServerProtocol,
  SerdeContextConfig,
} from "./protocols-schema/layer-0-interface-and-base/HttpServerProtocol";
export { RestServerProtocol } from "./protocols-schema/layer-1-abstracts/RestServerProtocol";
export { RpcServerProtocol } from "./protocols-schema/layer-1-abstracts/RpcServerProtocol";
export { SmithyRpcV2CborServerProtocol } from "./protocols-schema/layer-2-protocols/SmithyRpcV2CborServerProtocol";

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
