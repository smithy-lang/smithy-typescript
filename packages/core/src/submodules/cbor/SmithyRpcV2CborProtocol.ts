import { HttpInterceptingShapeSerializer, RpcProtocol } from "@smithy/core/protocols";
import { deref, ErrorSchema, OperationSchema, TypeRegistry } from "@smithy/core/schema";
import type {
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  ResponseMetadata,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { CborCodec, CborShapeSerializer } from "./CborCodec";
import { loadSmithyRpcV2CborErrorCode } from "./parseCborBody";

export class SmithyRpcV2CborProtocol extends RpcProtocol {
  private codec = new CborCodec();
  protected serializer = new HttpInterceptingShapeSerializer<CborShapeSerializer>(this.codec.createSerializer());
  protected deserializer = this.codec.createDeserializer();

  public getShapeId(): string {
    return "smithy.protocols#rpcv2Cbor";
  }

  public async serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext
  ): Promise<IHttpRequest> {
    const request = await super.serializeRequest(operationSchema, input, context);
    Object.assign(request.headers, {
      "content-type": "application/cbor",
      "smithy-protocol": "rpc-v2-cbor",
      accept: "application/cbor",
    });
    if (deref(operationSchema.input) === "unit") {
      delete request.body;
      delete request.headers["content-type"];
    } else {
      if (!request.body) {
        this.serializer.write(15, {});
        request.body = this.serializer.flush();
      }
      try {
        request.headers["content-length"] = String((request.body as Uint8Array).byteLength);
      } catch (e) {}
    }
    const { service, operation } = getSmithyContext(context) as {
      service: string;
      operation: string;
    };
    const path = `/service/${service}/operation/${operation}`;
    if (request.path.endsWith("/")) {
      request.path = request.path + path.slice(1);
    } else {
      request.path = request.path + path;
    }
    request.method = "POST";
    return request;
  }

  public async deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext,
    response: IHttpResponse
  ): Promise<Output> {
    return super.deserializeResponse<Output>(operationSchema, context, response);
  }

  protected async handleError(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext,
    response: IHttpResponse,
    dataObject: any,
    metadata: ResponseMetadata
  ): Promise<never> {
    const error = loadSmithyRpcV2CborErrorCode(response, dataObject) ?? "Unknown";

    const registry = TypeRegistry.schemaToRegistry.get(operationSchema);
    if (!registry) {
      // TODO(schema) throw client base exception using the dataObject.
      throw new Error("registry not found for " + error);
    }
    const errorSchema: ErrorSchema = registry.getSchema(error) as ErrorSchema;

    if (!errorSchema) {
      // TODO(schema) throw client base exception using the dataObject.
      throw new Error("schema not found for " + error);
    }

    const message = dataObject.message ?? dataObject.Message ?? "Unknown";
    const exception = new errorSchema.ctor(message);
    Object.assign(exception, {
      $metadata: metadata,
      $response: response,
      message,
      ...dataObject,
    });

    throw exception;
  }
}
