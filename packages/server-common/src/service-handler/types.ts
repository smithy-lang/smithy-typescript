/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpRequest } from "@smithy/core/protocols";
import type { MetricsRecorder, StaticOperationSchema } from "@smithy/types";

import type { RequestIdentity } from "../identity";

export type UserAttributeKey = string | symbol;
export type UserAttributes = Map<UserAttributeKey, unknown>;
export type ReadonlyUserAttributes = ReadonlyMap<UserAttributeKey, unknown>;

/**
 * Framework request created by a supported server adapter.
 *
 * @public
 */
export interface ServerRequest<Identity extends RequestIdentity = RequestIdentity> {
  readonly request: Readonly<HttpRequest>;
  readonly identity: Readonly<Identity>;
  readonly userAttributes: UserAttributes;
}

/**
 * Runtime operation definition generated from the Smithy model.
 *
 * @public
 */
export type OperationDefinition = StaticOperationSchema;

/**
 * Framework context passed to an operation.
 *
 * @public
 */
export interface ServerOperationContext<Identity extends RequestIdentity = RequestIdentity, MetricsNative = unknown> {
  readonly request: Readonly<{
    readonly request: Readonly<HttpRequest>;
    readonly identity: Readonly<Identity>;
    readonly userAttributes: ReadonlyUserAttributes;
  }>;
  readonly operation: string;
  readonly operationDefinition: Readonly<OperationDefinition>;
  readonly identity: Readonly<Identity>;
  readonly metricsRecorder?: MetricsRecorder<MetricsNative>;
  readonly userAttributes: ReadonlyUserAttributes;
}

/**
 * Business implementation for one modeled operation.
 *
 * @public
 */
export type ServerOperation<
  Input,
  Output,
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> = (input: Input, requestContext: ServerOperationContext<Identity, MetricsNative>) => Promise<Output>;
