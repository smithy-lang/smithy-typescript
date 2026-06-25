/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpRequest, HttpResponse } from "@smithy/core/protocols";

import type { SmithyFrameworkException } from "../errors";

/**
 * Identity established by the authenticate step. The shape is service-defined;
 * a successful auth scheme returns a value with at least a principal.
 */
export interface Caller {
  readonly principal: string;
}

/**
 * Read-only views passed to hooks. Each carries the fields populated at its
 * position. Fields are readonly; to change a value, return it from a modify hook.
 */
export interface RequestHook<UserContext> {
  readonly request: HttpRequest;
  readonly context: UserContext;
}

export interface AuthHook<UserContext> extends RequestHook<UserContext> {
  readonly authScheme: string;
  readonly caller: Caller;
}

export interface InputHook<UserContext> extends RequestHook<UserContext> {
  readonly operation: string;
  readonly input: unknown;
}

export interface OutputHook<UserContext> extends InputHook<UserContext> {
  readonly output: unknown;
}

export interface ResponseHook<UserContext> extends OutputHook<UserContext> {
  readonly response: HttpResponse;
}

export interface ExecutionHook<UserContext> {
  readonly request: HttpRequest;
  readonly context: UserContext;
  readonly operation?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly response?: HttpResponse;
  readonly error?: unknown;
}

/**
 * A service interceptor. Implement only the hooks you need.
 *
 * Read hooks observe and cannot replace a framework step. Modify hooks return
 * the value the next framework step runs on. Hooks are synchronous.
 */
export interface ServerInterceptor<UserContext = {}> {
  readBeforeExecution?(hook: RequestHook<UserContext>): void;
  readAfterAuthentication?(hook: AuthHook<UserContext>): void;
  readAfterDeserialization?(hook: InputHook<UserContext>): void;
  readAfterValidation?(hook: InputHook<UserContext>): void;
  readBeforeInvocation?(hook: InputHook<UserContext>): void;
  readAfterInvocation?(hook: OutputHook<UserContext>): void;
  readAfterSerialization?(hook: ResponseHook<UserContext>): void;
  readAfterExecution?(hook: ExecutionHook<UserContext>): void;

  modifyBeforeDeserialization?(hook: RequestHook<UserContext>): HttpRequest;
  modifyBeforeValidation?(hook: InputHook<UserContext>): unknown;
  modifyBeforeSerialization?(hook: OutputHook<UserContext>): unknown;
  modifyBeforeCompletion?(hook: ResponseHook<UserContext>): HttpResponse;
}

/**
 * An auth scheme run at the authenticate step. Returns a Caller on success, or
 * null/undefined to decline so the next registered scheme is tried.
 */
export interface AuthScheme<UserContext = {}> {
  readonly name: string;
  authenticate(request: HttpRequest, context: UserContext): Promise<Caller | null | undefined>;
}

/**
 * The framework steps, generated per handler. They run in a fixed pipeline order
 * and are not intended to be implemented by service teams; the generated handler
 * supplies them to its pipeline.
 */
export interface FrameworkSteps<Context> {
  route(request: HttpRequest): string | undefined;
  deserialize(operation: string, request: HttpRequest): Promise<unknown>;
  validate(operation: string, input: unknown): void;
  invoke(operation: string, input: unknown, context: Context): Promise<unknown>;
  serialize(operation: string, output: unknown): Promise<HttpResponse>;
  serializeError(operation: string | undefined, error: unknown): Promise<HttpResponse> | undefined;
  serializeFrameworkException(e: SmithyFrameworkException): Promise<HttpResponse>;
}
