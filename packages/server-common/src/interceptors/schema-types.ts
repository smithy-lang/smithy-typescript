/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { MetricsRecorder } from "@smithy/types";

import type { IdentityCaller, RequestIdentity } from "../identity";
import type { ReadonlyUserAttributes } from "../service-handler/types";

/**
 * Framework state available at the beginning of schema-based request execution.
 *
 * @public
 */
export interface RequestStartHook<Identity extends RequestIdentity = RequestIdentity, MetricsNative = unknown> {
  readonly request: Readonly<HttpRequest>;
  readonly identity: Readonly<Identity>;
  readonly metricsRecorder?: MetricsRecorder<MetricsNative>;
  readonly userAttributes: ReadonlyUserAttributes;
}

/**
 * Framework state available after schema-based authentication.
 *
 * @public
 */
export interface AuthenticationResultHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends RequestStartHook<Identity, MetricsNative> {
  readonly authScheme: string;
  readonly caller: Readonly<IdentityCaller<Identity>>;
}

/**
 * Framework state available after schema-based request deserialization.
 *
 * @public
 */
export interface OperationInputHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends RequestStartHook<Identity, MetricsNative> {
  readonly operation: string;
  readonly input: unknown;
}

/**
 * Framework state available after schema-based operation invocation.
 *
 * @public
 */
export interface OperationOutputHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends OperationInputHook<Identity, MetricsNative> {
  readonly output: unknown;
}

/**
 * Framework state available after schema-based response serialization.
 *
 * @public
 */
export interface SerializedResponseHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends OperationOutputHook<Identity, MetricsNative> {
  readonly response: HttpResponse;
}

/**
 * State available before returning a successful or error response.
 *
 * @public
 */
export interface RequestCompletionHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends RequestStartHook<Identity, MetricsNative> {
  readonly operation?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly response: HttpResponse;
}

/**
 * Final request state supplied to readAfterExecution.
 *
 * @public
 */
export interface ExecutionResultHook<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> extends RequestStartHook<Identity, MetricsNative> {
  readonly operation?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly response?: HttpResponse;
  readonly error?: unknown;
}

/**
 * An interceptor for the schema-based service pipeline.
 *
 * Read hooks observe framework state. Modify hooks replace the value supplied
 * to the next pipeline step.
 *
 * @public
 */
export interface SchemaServerInterceptor<Identity extends RequestIdentity = RequestIdentity, MetricsNative = unknown> {
  readBeforeExecution?(hook: RequestStartHook<Identity, MetricsNative>): void;
  readAfterAuthentication?(hook: AuthenticationResultHook<Identity, MetricsNative>): void;
  readAfterDeserialization?(hook: OperationInputHook<Identity, MetricsNative>): void;
  readAfterValidation?(hook: OperationInputHook<Identity, MetricsNative>): void;
  readBeforeInvocation?(hook: OperationInputHook<Identity, MetricsNative>): void;
  readAfterInvocation?(hook: OperationOutputHook<Identity, MetricsNative>): void;
  readAfterSerialization?(hook: SerializedResponseHook<Identity, MetricsNative>): void;
  readAfterExecution?(hook: ExecutionResultHook<Identity, MetricsNative>): void;

  modifyBeforeDeserialization?(hook: RequestStartHook<Identity, MetricsNative>): HttpRequest;
  modifyBeforeValidation?(hook: OperationInputHook<Identity, MetricsNative>): unknown;
  modifyBeforeSerialization?(hook: OperationOutputHook<Identity, MetricsNative>): unknown;
  modifyBeforeCompletion?(hook: RequestCompletionHook<Identity, MetricsNative>): HttpResponse;
}

/**
 * An authentication scheme for the schema-based service pipeline. Schemes run
 * in constructor order; the first non-null caller wins.
 *
 * @public
 */
export interface SchemaAuthScheme<Identity extends RequestIdentity = RequestIdentity> {
  readonly name: string;
  authenticate(
    request: Readonly<HttpRequest>,
    identity: Readonly<Identity>
  ): Promise<Readonly<IdentityCaller<Identity>> | null | undefined>;
}
