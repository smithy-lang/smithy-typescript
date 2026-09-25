/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { HttpResponse, JsonCodec2 } from "@smithy/core/protocols";
import type {
  DocumentSchema,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
  StaticOperationSchema,
} from "@smithy/types";

import { ServiceException, UnsupportedMediaTypeException } from "../../validation/errors";
import { SerializationException } from "../../validation/errors";
import { RpcServerProtocol } from "../layer-1-abstracts/RpcServerProtocol";

/**
 * JSON settings for Smithy RPCv2 JSON.
 *
 * Per the spec, timestamps are always serialized as epoch-seconds and the
 * `timestampFormat` trait MUST NOT be respected (`useTrait: false`). Property
 * names in the wire format match member names exactly (`jsonName: false`).
 */
const RPC_V2_JSON_SETTINGS = {
  timestampFormat: {
    useTrait: false,
    default: 7 as const, // epoch-seconds
  },
  jsonName: false,
  // RPCv2 JSON serializes bigInteger/bigDecimal as JSON strings (SEP).
  bigNumberAsString: true,
} as const;

/**
 * Server protocol implementation for Smithy RPCv2 JSON.
 *
 * Uses JSON serialization for request/response bodies.
 * Routing is path-based: /service/{ServiceName}/operation/{OperationName}
 *
 * @see https://smithy.io/2.0/additional-specs/protocols/smithy-rpc-v2.html
 *
 * @public
 */
export class SmithyRpcV2JsonServerProtocol extends RpcServerProtocol {
  private codec = new JsonCodec2(RPC_V2_JSON_SETTINGS);
  protected serializer: ShapeSerializer<Uint8Array> = this.codec.createSerializer();
  protected deserializer: ShapeDeserializer<Uint8Array> = this.codec.createDeserializer() as ShapeDeserializer<any>;

  public constructor(options: { defaultNamespace: string }) {
    super(options);
  }

  public override getShapeId(): string {
    return "smithy.protocols#rpcv2Json";
  }

  protected override getDefaultContentType(): string {
    return "application/json";
  }

  /**
   * @override - Sets serde context on the codec and serializer/deserializer.
   */
  public override setSerdeContext(serdeContext: SerdeFunctions): void {
    super.setSerdeContext(serdeContext);
    this.codec.setSerdeContext(serdeContext);
  }

  /**
   * @override - Validates protocol-specific request headers.
   *
   * Per the spec:
   * - Content-Type, when present, MUST be application/json.
   * - Smithy-Protocol header MUST be present with value "rpc-v2-json".
   * - X-Amz-Target and X-Amzn-Target headers MUST NOT be present.
   */
  protected override validateContentType(request: IHttpRequest): void {
    const contentType = this.getHeaderValue(request, "content-type");
    if (contentType !== undefined && contentType !== this.getDefaultContentType()) {
      throw new UnsupportedMediaTypeException();
    }
    this.validateProtocolHeaders(request);
  }

  /**
   * Validates protocol identity headers independently of Content-Type.
   * Called for all requests including event stream operations.
   */
  private validateProtocolHeaders(request: IHttpRequest): void {
    const smithyProtocol = this.getHeaderValue(request, "smithy-protocol");
    if (smithyProtocol !== "rpc-v2-json") {
      throw new SerializationException();
    }

    if (
      this.getHeaderValue(request, "x-amz-target") !== undefined ||
      this.getHeaderValue(request, "x-amzn-target") !== undefined
    ) {
      throw new SerializationException();
    }
  }

  /**
   * @override - For event stream operations, skip content-type validation but
   * still validate protocol identity headers.
   */
  public override async deserializeRequest<Input extends object>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    request: IHttpRequest
  ): Promise<Input> {
    // Always validate protocol identity headers regardless of event stream.
    this.validateProtocolHeaders(request);
    return super.deserializeRequest(operationSchema, context, request);
  }

  /**
   * @override - Adds the smithy-protocol header to responses.
   */
  protected override async serializeSuccess<Output extends object>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    output: Output
  ): Promise<IHttpResponse> {
    const response = await super.serializeSuccess(operationSchema, context, output);
    response.headers["smithy-protocol"] = "rpc-v2-json";
    return response;
  }

  /**
   * @override - Serializes an operation error as an RPCv2 JSON error response.
   *
   * Per the spec:
   * - The body MUST contain a `__type` field whose value is the error's
   *   absolute Shape ID (namespace#name).
   * - The body SHOULD contain a `message` field.
   * - The HTTP status code comes from `@httpError`, else 500 for a server
   *   fault, else 400.
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

    // RPCv2 JSON uses the absolute Shape ID for __type.
    const namespace = (this as any).options?.defaultNamespace;
    const errorType = errorName.includes("#") ? errorName : namespace ? `${namespace}#${errorName}` : errorName;

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
        "smithy-protocol": "rpc-v2-json",
      },
      body,
    });
  }

  /**
   * @override - Adds the smithy-protocol header to framework error responses.
   */
  protected override serializeFrameworkException(error: any): IHttpResponse {
    const response = super.serializeFrameworkException(error);
    response.headers["smithy-protocol"] = "rpc-v2-json";
    return response;
  }
}
