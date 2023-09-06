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

export * as httpbinding from "./httpbinding";
export * from "./accept";
export * from "./errors";
export * from "./validation";
export * from "./unique";

import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { SerdeContext } from "@smithy/types";

import { ServiceException } from "./errors";

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
}

export interface ServiceCoordinate<S extends string, O extends string> {
  readonly service: S;
  readonly operation: O;
}
export interface Mux<S extends string, O extends string> {
  match(req: HttpRequest): ServiceCoordinate<S, O> | undefined;
}

export interface ServerSerdeContext extends Omit<SerdeContext, "endpoint"> {}
