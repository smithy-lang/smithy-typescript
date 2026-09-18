import { RpcProtocol } from "@smithy/core/protocols";
import { NormalizedSchema, TypeRegistry, deref } from "@smithy/core/schema";
import { getSmithyContext } from "@smithy/core/transport";
import type {
  EndpointBearer,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  ResponseMetadata,
  SerdeFunctions,
} from "@smithy/types";

import { CborCodec } from "./CborCodec";
import { loadSmithyRpcV2CborErrorCode } from "./parseCborBody";

/**
 * Client protocol for Smithy RPCv2 CBOR.
 *
 * @public
 */
export class SmithyRpcV2CborProtocol extends RpcProtocol {
  /**
   * @override
   */
  declare protected compositeErrorRegistry: TypeRegistry;
  private codec = new CborCodec();
  protected serializer = this.codec.createSerializer();
  protected deserializer = this.codec.createDeserializer();

  public constructor({
    defaultNamespace,
    errorTypeRegistries,
  }: {
    defaultNamespace: string;
    errorTypeRegistries?: TypeRegistry[];
  }) {
    super({ defaultNamespace, errorTypeRegistries });
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
      if (request.body instanceof Uint8Array) {
        request.headers["content-length"] = String(request.body.byteLength);
      }
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
    const errorIdentifier = loadSmithyRpcV2CborErrorCode(response, dataObject) ?? "Unknown";
    const preferredNamespaces = ["*"];

    const { defaultNamespace } = this.options;
    preferredNamespaces.unshift(defaultNamespace);

    const [namespace, errorShapeName] = (() => {
      if (errorIdentifier.includes("#")) {
        return errorIdentifier.split("#");
      }
      return [undefined, errorIdentifier];
    })();
    if (namespace) {
      preferredNamespaces.unshift(namespace);
    }

    const errorMetadata = {
      $metadata: metadata,
      $fault: response.statusCode < 500 ? ("client" as const) : ("server" as const),
    };

    const preferredRegistries = [this.compositeErrorRegistry];
    if (namespace) {
      preferredRegistries.push(TypeRegistry.for(namespace));
    }
    preferredRegistries.push(TypeRegistry.for(defaultNamespace));

    const [errorSchema, ErrorCtor, errorMode] = this.resolveError(
      errorShapeName,
      preferredNamespaces,
      preferredRegistries
    );

    if (errorMode === "native" || errorMode === "synthetic") {
      if (dataObject.Message) {
        dataObject.message = dataObject.Message;
      }
      const error: Error =
        errorMode === "synthetic" ? new ErrorCtor({ name: errorShapeName }) : new Error(errorShapeName);
      throw Object.assign(error, errorMetadata, dataObject);
    }

    const ns = NormalizedSchema.of(errorSchema);
    const message = dataObject.message ?? dataObject.Message ?? "Unknown";
    const exception = new ErrorCtor({});

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
