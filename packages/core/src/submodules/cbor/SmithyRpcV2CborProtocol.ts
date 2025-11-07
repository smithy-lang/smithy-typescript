import { RpcProtocol } from "@smithy/core/protocols";
import type { ErrorSchema } from "@smithy/core/schema";
import { deref, NormalizedSchema, TypeRegistry } from "@smithy/core/schema";
import type {
  EndpointBearer,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  ResponseMetadata,
  SerdeFunctions,
  StaticErrorSchema,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { CborCodec } from "./CborCodec";
import { loadSmithyRpcV2CborErrorCode } from "./parseCborBody";

/**
 * Client protocol for Smithy RPCv2 CBOR.
 *
 * @public
 */
export class SmithyRpcV2CborProtocol extends RpcProtocol {
  private codec = new CborCodec();
  protected serializer = this.codec.createSerializer();
  protected deserializer = this.codec.createDeserializer();

  public constructor({ defaultNamespace }: { defaultNamespace: string }) {
    super({ defaultNamespace });
  }

  public getShapeId(): string {
    return "smithy.protocols#rpcv2Cbor";
  }

  public getPayloadCodec(): CborCodec {
    return this.codec;
  }

  public async serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<IHttpRequest> {
    const request = await super.serializeRequest(operationSchema, input, context);
    Object.assign(request.headers, {
      "content-type": this.getDefaultContentType(),
      "smithy-protocol": "rpc-v2-cbor",
      accept: this.getDefaultContentType(),
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
      request.path += path.slice(1);
    } else {
      request.path += path;
    }
    return request;
  }

  public async deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse
  ): Promise<Output> {
    return super.deserializeResponse<Output>(operationSchema, context, response);
  }

  protected async handleError(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    dataObject: any,
    metadata: ResponseMetadata
  ): Promise<never> {
    const errorName = loadSmithyRpcV2CborErrorCode(response, dataObject) ?? "Unknown";

    let namespace = this.options.defaultNamespace;
    if (errorName.includes("#")) {
      [namespace] = errorName.split("#");
    }

    const errorMetadata = {
      $metadata: metadata,
      $response: response,
      $fault: response.statusCode <= 500 ? ("client" as const) : ("server" as const),
    };

    const registry = TypeRegistry.for(namespace);

    let errorSchema: StaticErrorSchema;
    try {
      errorSchema = registry.getSchema(errorName) as StaticErrorSchema;
    } catch (e) {
      if (dataObject.Message) {
        dataObject.message = dataObject.Message;
      }
      const synthetic = TypeRegistry.for("smithy.ts.sdk.synthetic." + namespace);
      const baseExceptionSchema = synthetic.getBaseException();
      if (baseExceptionSchema) {
        const ErrorCtor = synthetic.getErrorCtor(baseExceptionSchema);
        throw Object.assign(new ErrorCtor({ name: errorName }), errorMetadata, dataObject);
      }
      throw Object.assign(new Error(errorName), errorMetadata, dataObject);
    }

    const ns = NormalizedSchema.of(errorSchema);
    const ErrorCtor = registry.getErrorCtor(errorSchema);
    const message = dataObject.message ?? dataObject.Message ?? "Unknown";
    const exception = new ErrorCtor(message);

    const output = {} as any;
    for (const [name, member] of ns.structIterator()) {
      output[name] = this.deserializer.readValue(member, dataObject[name]);
    }

    throw Object.assign(
      exception,
      errorMetadata,
      {
        $fault: ns.getMergedTraits().error,
        message,
      },
      output
    );
  }

  protected getDefaultContentType(): string {
    return "application/cbor";
  }
}
