/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { JsonCodec2 } from "@aws-sdk/core/protocols";
import { FromStringShapeDeserializer, HttpResponse } from "@smithy/core/protocols";
import type {
  DocumentSchema,
  HttpResponse as IHttpResponse,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
  StaticOperationSchema,
} from "@smithy/types";

import { ServiceException } from "../../validation/errors";
import { RestServerProtocol } from "../layer-1-abstracts/RestServerProtocol";

/**
 * JSON settings for AWS restJson1.
 *
 * Per the spec, timestamps default to epoch-seconds in JSON payloads,
 * and the jsonName trait is honored for property naming.
 */
const REST_JSON_SETTINGS = {
  timestampFormat: {
    useTrait: true,
    default: 7 as const, // epoch-seconds
  },
  jsonName: true,
} as const;

/**
 * Server protocol implementation for AWS restJson1.
 *
 * Uses JSON serialization for request/response bodies with HTTP binding traits
 * for routing members across path, query, headers, and body.
 *
 * Error responses include the `X-Amzn-Errortype` header containing the error
 * shape name, and the body includes a `__type` field and `message`.
 *
 * @see https://smithy.io/2.0/aws/protocols/aws-restjson1-protocol.html
 *
 * @public
 */
export class AwsRestJsonServerProtocol extends RestServerProtocol {
  private codec = new JsonCodec2(REST_JSON_SETTINGS);
  protected serializer: ShapeSerializer<Uint8Array> = this.codec.createSerializer();
  protected deserializer: ShapeDeserializer<Uint8Array> = this.codec.createDeserializer() as ShapeDeserializer<any>;
  protected stringDeserializer: FromStringShapeDeserializer = new FromStringShapeDeserializer(REST_JSON_SETTINGS);

  public constructor(options: { defaultNamespace: string }) {
    super(options);
  }

  public override getShapeId(): string {
    return "aws.protocols#restJson1";
  }

  protected override getDefaultContentType(): string {
    return "application/json";
  }

  /**
   * Sets serde context on the codec and string deserializer.
   */
  public override setSerdeContext(serdeContext: SerdeFunctions): void {
    super.setSerdeContext(serdeContext);
    this.codec.setSerdeContext(serdeContext);
    this.stringDeserializer.setSerdeContext(serdeContext);
  }

  /**
   * Serializes an operation error as a restJson1 error response.
   *
   * Per the spec:
   * - The `X-Amzn-Errortype` header MUST contain the error shape name.
   * - The body contains `__type` (shape name) and `message`.
   * - The HTTP status code comes from the @httpError trait, defaulting to
   *   400 for client errors and 500 for server errors.
   */
  protected override async serializeError<E extends Error>(
    _operationSchema: StaticOperationSchema,
    _context: SerdeFunctions,
    error: E
  ): Promise<IHttpResponse> {
    const errorName = (error as any).name ?? "UnknownError";
    const fault: string | undefined = (error as any).$fault;
    const statusCode =
      (error as any).$metadata?.httpStatusCode ?? (error as any).statusCode ?? (fault === "client" ? 400 : 500);

    const errorBody: Record<string, any> = {};

    // Include message if available.
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
        "x-amzn-errortype": errorName,
      },
      body,
    });
  }
}
