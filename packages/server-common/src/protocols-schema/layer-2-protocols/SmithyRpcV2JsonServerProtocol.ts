/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { HttpResponse, JsonCodec2 } from "@smithy/core/protocols";
import type { JsonShapeSerializer2 } from "@smithy/core/protocols";
import { hasOwn } from "@smithy/core/serde";
import { NormalizedSchema, TypeRegistry } from "@smithy/core/schema";
import type {
  DocumentSchema,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  Logger,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
  StaticErrorSchema,
  StaticOperationSchema,
} from "@smithy/types";

import { ServiceException, UnsupportedMediaTypeException } from "../../validation/errors";
import { SerializationException } from "../../validation/errors";
import { RpcServerProtocol } from "../layer-1-abstracts/RpcServerProtocol";

const RPC_ROUTE = /\/service\/[^/]+\/operation\/([^/?]+)/;

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

  public override claim(request: IHttpRequest, logger?: Logger): boolean {
    const logPrefix = `@smithy/server-common::SmithyRpcV2JsonServerProtocol`;
    if (this.getHeaderValue(request, "smithy-protocol") !== "rpc-v2-json") {
      logger?.debug?.(`${logPrefix}: smithy-protocol header not matched.`);
      return false;
    }

    // Per the SEP, every RPC v2 request MUST be sent with the POST method.
    if (request.method?.toUpperCase() !== "POST") {
      logger?.debug?.(`${logPrefix}: request method is not POST.`);
      return false;
    }

    // The request path MUST match /service/{serviceName}/operation/{operationName}.
    // Note: the {serviceName} segment is not yet verified against this service's
    // shape name (the server protocol does not currently receive it), so a path
    // for another service can still match here; operation resolution in route()
    // provides a partial backstop.
    if (!RPC_ROUTE.test(request.path)) {
      logger?.debug?.(`${logPrefix}: request path not matched.`);
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
    const logPrefix = `@smithy/server-common::SmithyRpcV2JsonServerProtocol`;
    const match = RPC_ROUTE.exec(request.path);
    if (!match) {
      logger?.debug?.(`${logPrefix}: request path not matched.`);
      return undefined;
    }

    const requestedOperation = match[1];
    if (!requestedOperation) {
      logger?.debug?.(`${logPrefix}: request operation not found.`);
      return undefined;
    }

    const operationName = hasOwn(operationSchemas, requestedOperation) ? requestedOperation : undefined;
    logger?.debug?.(`${logPrefix}: routed ${operationName ? `operation ${operationName}` : "an unknown operation"}.`);
    return operationName;
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
    const fault: string | undefined = (error as any).$fault;
    const statusCode =
      (error as any).$metadata?.httpStatusCode ?? (error as any).statusCode ?? (fault === "client" ? 400 : 500);

    // Prefer serializing through the modeled error schema. The schema carries
    // the error's absolute Shape ID (so __type is correct even for errors in a
    // namespace other than the service default) and drives member encoding (so
    // typed members like bigInteger/bigDecimal/blob/timestamp are serialized
    // according to the RPCv2 JSON representation rather than as raw JS values).
    const errorSchema = this.resolveErrorSchema(error);

    let body: Uint8Array;
    if (errorSchema) {
      const errorObject: Record<string, any> = {};
      if ((error as any).message !== undefined) {
        errorObject.message = (error as any).message;
      }
      const ns = NormalizedSchema.of(errorSchema);
      for (const [memberName] of ns.structIterator()) {
        const value = (error as any)[memberName];
        if (value !== undefined) {
          errorObject[memberName] = value;
        }
      }
      // writeDiscriminatedDocument serializes the struct with its schema and
      // injects __type as the schema's absolute Shape ID (namespace#name).
      (this.serializer as unknown as JsonShapeSerializer2).writeDiscriminatedDocument(errorSchema, errorObject);
      body = this.serializer.flush();
    } else {
      // Unmodeled / framework error: fall back to a bare document body. Without
      // a schema the best available discriminator is the runtime error name,
      // qualified with the service's default namespace when not already absolute.
      const errorName = (error as any).name ?? "UnknownError";
      const namespace = (this as any).options?.defaultNamespace;
      const errorType = errorName.includes("#") ? errorName : namespace ? `${namespace}#${errorName}` : errorName;

      const errorBody: Record<string, any> = { __type: errorType };
      if ((error as any).message) {
        errorBody.message = (error as any).message;
      }
      if (error instanceof ServiceException) {
        for (const [key, value] of Object.entries(error)) {
          if (key !== "name" && key !== "$fault" && key !== "$metadata" && key !== "message" && value !== undefined) {
            errorBody[key] = value;
          }
        }
      }
      this.serializer.write(15 satisfies DocumentSchema, errorBody);
      body = this.serializer.flush();
    }

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
   * Resolves the modeled error schema for a thrown error by matching its
   * prototype against the error constructors registered in the type
   * registries. Mirrors the lookup used by `resolveErrorStatusCode`.
   *
   * @returns the matching StaticErrorSchema, or undefined for unmodeled errors.
   */
  private resolveErrorSchema(error: object): StaticErrorSchema | undefined {
    const isStaticErrorSchema = (schema: unknown): schema is StaticErrorSchema =>
      Array.isArray(schema) && schema[0] === -3;

    for (const registry of TypeRegistry.registries.values()) {
      const match = registry.find((schema) => {
        if (!isStaticErrorSchema(schema)) {
          return false;
        }
        const ctor = registry.getErrorCtor(schema);
        return typeof ctor === "function" && ctor.prototype?.isPrototypeOf(error);
      });
      if (isStaticErrorSchema(match)) {
        return match;
      }
    }
    return undefined;
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
