import { AbstractRpcV2Protocol } from "@smithy/core/protocols";
import { NormalizedSchema, TypeRegistry } from "@smithy/core/schema";
import type {
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
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
export class SmithyRpcV2CborProtocol extends AbstractRpcV2Protocol {
  private codec = new CborCodec();
  protected serializer = this.codec.createSerializer();
  protected deserializer = this.codec.createDeserializer();

  public getShapeId(): string {
    return "smithy.protocols#rpcv2Cbor";
  }

  public getPayloadCodec(): CborCodec {
    return this.codec;
  }

  protected getSmithyProtocolHeaderValue(): string {
    return "rpc-v2-cbor";
  }

  protected applyEmptyBody(request: IHttpRequest): void {
    if (!request.body) {
      this.serializer.write(15, {});
      request.body = this.serializer.flush();
    }
    if (request.body instanceof Uint8Array) {
      request.headers["content-length"] = String(request.body.byteLength);
    }
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
