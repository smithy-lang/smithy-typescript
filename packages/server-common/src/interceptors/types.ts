/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { MetricsRecorder } from "@smithy/types";

import type { IdentityCaller, RequestIdentity } from "../identity";
import type { ReadonlyUserAttributes } from "../service-handler/types";

/**
 * Framework state available at the beginning of request execution.
 *
 * @public
 */
export interface RequestHook<Identity extends RequestIdentity = RequestIdentity, MetricsNative = unknown> {
  readonly request: Readonly<HttpRequest>;
  readonly identity: Readonly<Identity>;
  readonly metricsRecorder?: MetricsRecorder<MetricsNative>;
  readonly userAttributes: ReadonlyUserAttributes;
}

/**
 * Framework state available after authentication.
 *
 * @public
 */
export interface AuthHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends RequestHook<Identity, MetricsNative> {
  readonly authScheme: string;
  readonly caller: Readonly<IdentityCaller<Identity>>;
}

/**
 * Framework state available after request deserialization.
 *
 * @public
 */
export interface InputHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends RequestHook<Identity, MetricsNative> {
  readonly operation: string;
  readonly input: unknown;
}

/**
 * Framework state available after operation invocation.
 *
 * @public
 */
export interface OutputHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends InputHook<Identity, MetricsNative> {
  readonly output: unknown;
}

/**
 * Framework state available after response serialization.
 *
 * @public
 */
export interface ResponseHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends OutputHook<Identity, MetricsNative> {
  readonly response: HttpResponse;
}

/**
 * Final request state supplied to readAfterExecution.
 *
 * @public
 */
export interface ExecutionHook<Identity extends RequestIdentity = RequestIdentity, MetricsNative = unknown> {
  readonly request: Readonly<HttpRequest>;
  readonly identity: Readonly<Identity>;
  readonly metricsRecorder?: MetricsRecorder<MetricsNative>;
  readonly userAttributes: ReadonlyUserAttributes;
  readonly operation?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly response?: HttpResponse;
  readonly error?: unknown;
}

/**
 * A service interceptor. Implement only the hooks needed by the application.
 *
 * Read hooks observe framework state. Modify hooks replace the value supplied
 * to the next pipeline step.
 *
 * @public
 */
export interface ServerInterceptor<Identity extends RequestIdentity = RequestIdentity, MetricsNative = unknown> {
  readBeforeExecution?(hook: RequestHook<Identity, MetricsNative>): void;
  readAfterAuthentication?(hook: AuthHook<Identity, MetricsNative>): void;
  readAfterDeserialization?(hook: InputHook<Identity, MetricsNative>): void;
  readAfterValidation?(hook: InputHook<Identity, MetricsNative>): void;
  readBeforeInvocation?(hook: InputHook<Identity, MetricsNative>): void;
  readAfterInvocation?(hook: OutputHook<Identity, MetricsNative>): void;
  readAfterSerialization?(hook: ResponseHook<Identity, MetricsNative>): void;
  readAfterExecution?(hook: ExecutionHook<Identity, MetricsNative>): void;

  modifyBeforeDeserialization?(hook: RequestHook<Identity, MetricsNative>): HttpRequest;
  modifyBeforeValidation?(hook: InputHook<Identity, MetricsNative>): unknown;
  modifyBeforeSerialization?(hook: OutputHook<Identity, MetricsNative>): unknown;
  modifyBeforeCompletion?(hook: ResponseHook<Identity, MetricsNative>): HttpResponse;
}

/**
 * An authentication scheme. Schemes run in constructor order; the first
 * non-null caller wins.
 *
 * @public
 */
export interface AuthScheme<Identity extends RequestIdentity = RequestIdentity> {
  readonly name: string;
  authenticate(
    request: Readonly<HttpRequest>,
    identity: Readonly<Identity>
  ): Promise<Readonly<IdentityCaller<Identity>> | null | undefined>;
}
