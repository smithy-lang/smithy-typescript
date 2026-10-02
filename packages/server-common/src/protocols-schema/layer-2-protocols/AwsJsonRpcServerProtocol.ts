/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { JsonCodec2 } from "@aws-sdk/core/protocols";
import { HttpResponse } from "@smithy/core/protocols";
import { hasOwn } from "@smithy/core/serde";
import type {
  DocumentSchema,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  Logger,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
  StaticOperationSchema,
} from "@smithy/types";

import { ServiceException, UnsupportedMediaTypeException } from "../../validation/errors";
import { resolveErrorStatusCode } from "../error-status";
import { RpcServerProtocol } from "../layer-1-abstracts/RpcServerProtocol";

/**
 * Options for constructing an {@link AwsJsonRpcServerProtocol}.
 *
 * @public
 */
export interface AwsJsonRpcServerProtocolOptions {
  defaultNamespace: string;
  /**
   * When `true`, uses AWS JSON 1.1 behavior:
   * - Content-Type: `application/x-amz-json-1.1`
   * - Error `__type` contains only the shape name.
   *
   * When `false` (default), uses AWS JSON 1.0 behavior:
   * - Content-Type: `application/x-amz-json-1.0`
   * - Error `__type` contains the full Shape ID (namespace#name).
   */
  isVersion1_1?: boolean;
}

/**
 * JSON settings for AWS JSON 1.0/1.1.
 *
 * Timestamps default to epoch-seconds. The jsonName trait is NOT used —
 * property names in the wire format match member names exactly.
 */
const AWS_JSON_RPC_SETTINGS = {
  timestampFormat: {
    useTrait: true,
    default: 7 as const, // epoch-seconds
  },
  jsonName: false,
} as const;

/**
 * Server protocol implementation for AWS JSON 1.0 and AWS JSON 1.1.
 *
 * Both versions use the same RPC semantics:
 * - All requests are `POST /`
 * - Operation routing via `X-Amz-Target: {ServiceName}.{OperationName}` header
 * - Entire input/output is serialized as a JSON document body
 * - No HTTP binding traits are supported
 *
 * The two versions differ only in:
 * - Content-Type header value
 * - Error type serialization (full Shape ID vs shape name only)
 *
 * @see https://smithy.io/2.0/aws/protocols/aws-json-1_0-protocol.html
 * @see https://smithy.io/2.0/aws/protocols/aws-json-1_1-protocol.html
 *
 * @public
 */
export class AwsJsonRpcServerProtocol extends RpcServerProtocol {
  private codec = new JsonCodec2(AWS_JSON_RPC_SETTINGS);
  protected serializer: ShapeSerializer<Uint8Array> = this.codec.createSerializer();
  protected deserializer: ShapeDeserializer<Uint8Array> = this.codec.createDeserializer() as ShapeDeserializer<any>;
  private readonly isVersion1_1: boolean;

  public constructor(options: AwsJsonRpcServerProtocolOptions) {
    super(options);
    this.isVersion1_1 = options.isVersion1_1 ?? false;
  }

  public override getShapeId(): string {
    return this.isVersion1_1 ? "aws.protocols#awsJson1_1" : "aws.protocols#awsJson1_0";
  }

  public override claim(request: IHttpRequest, logger?: Logger): boolean {
    const logPrefix = `@smithy/server-common::AwsJsonRpcServerProtocol`;
    if (request.method.toUpperCase() !== "POST") {
      return false;
    }

    const contentType = this.getHeaderValue(request, "content-type");
    if (contentType !== undefined && contentType !== this.getDefaultContentType()) {
      logger?.debug?.(`${logPrefix}: content-type did not match ${this.getShapeId()}.`);
      return false;
    }

    const target = this.getHeaderValue(request, "x-amz-target");
    if (!target) {
      logger?.debug?.(`${logPrefix}: X-Amz-Target header not found.`);
      return false;
    }

    logger?.debug?.(`${logPrefix}: protocol claimed.`);
    return true;
  }

  public override route(
    request: IHttpRequest,
    operationSchemas: Readonly<Record<string, StaticOperationSchema>>,
    logger?: Logger
  ): string | undefined {
    const logPrefix = `@smithy/server-common::AwsJsonRpcServerProtocol`;
    const target = this.getHeaderValue(request, "x-amz-target");
    if (!target) {
      logger?.debug?.(`${logPrefix}: X-Amz-Target header not found while routing.`);
      return undefined;
    }

    const separator = target.lastIndexOf(".");
    if (separator < 0) {
      logger?.debug?.(`${logPrefix}: malformed X-Amz-Target header.`);
      return undefined;
    }

    const requestedOperation = target.slice(separator + 1);
    const operationName = hasOwn(operationSchemas, requestedOperation) ? requestedOperation : undefined;
    logger?.debug?.(`${logPrefix}: routed ${operationName ? `operation ${operationName}` : "an unknown operation"}.`);
    return operationName;
  }

  protected override getDefaultContentType(): string {
    return this.isVersion1_1 ? "application/x-amz-json-1.1" : "application/x-amz-json-1.0";
  }

  /**
   * Sets serde context on the codec.
   */
  public override setSerdeContext(serdeContext: SerdeFunctions): void {
    super.setSerdeContext(serdeContext);
    this.codec.setSerdeContext(serdeContext);
  }

  /**
   * Validates that Content-Type matches the expected value.
   *
   * Per the spec, the Content-Type MUST be `application/x-amz-json-1.0`
   * or `application/x-amz-json-1.1` respectively.
   */
  protected override validateContentType(request: IHttpRequest): void {
    const contentType = this.getHeaderValue(request, "content-type");
    if (contentType !== undefined && contentType !== this.getDefaultContentType()) {
      throw new UnsupportedMediaTypeException();
    }
  }

  /**
   * Serializes an operation error as an AWS JSON RPC error response.
   *
   * Per the spec:
   * - The body SHOULD contain a `__type` field.
   * - For 1.0: `__type` contains the full Shape ID (e.g., `smithy.example#FooError`).
   * - For 1.1: `__type` contains only the shape name (e.g., `FooError`).
   * - The HTTP status code comes from explicit runtime status, the modeled
   *   @httpError trait, or the error's $fault.
   */
  protected override async serializeError<E extends Error>(
    _operationSchema: StaticOperationSchema,
    _context: SerdeFunctions,
    error: E
  ): Promise<IHttpResponse> {
    const errorName = (error as any).name ?? "UnknownError";
    const statusCode = resolveErrorStatusCode(error);

    // For 1.0, use the full shape ID; for 1.1, use only the shape name.
    const namespace = (this as any).options?.defaultNamespace;
    const errorType = this.isVersion1_1 ? errorName : namespace ? `${namespace}#${errorName}` : errorName;

    const errorBody: Record<string, any> = {
      __type: errorType,
    };

    if ((error as any).message) {
      errorBody.message = (error as any).message;
    }

    // Include additional modeled members from ServiceException instances.
    if (error instanceof ServiceException) {
      for (const [key, value] of Object.entries(error)) {
        if (key !== "name" && key !== "$fault" && key !== "$metadata" && key !== "message" && value !== undefined) {
          errorBody[key] = value;
        }
      }
    }

    this.serializer.write(15 satisfies DocumentSchema, errorBody);
    const body = this.serializer.flush();

    return new HttpResponse({
      statusCode,
      headers: {
        "content-type": this.getDefaultContentType(),
      },
      body,
    });
  }
}
