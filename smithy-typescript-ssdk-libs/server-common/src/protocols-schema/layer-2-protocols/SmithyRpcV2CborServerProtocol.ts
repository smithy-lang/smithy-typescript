import { CborCodec } from "@smithy/core/cbor";
import type { HttpRequest as IHttpRequest, HttpResponse as IHttpResponse } from "@smithy/types";
import { RpcServerProtocol } from "../layer-1-abstracts/RpcServerProtocol";
import { SerializationException } from "../../errors";

/**
 * Server protocol implementation for Smithy RPCv2 CBOR.
 *
 * Uses CBOR serialization for request/response bodies.
 * Routing is path-based: /service/{ServiceName}/operation/{OperationName}
 *
 * @public
 */
export class SmithyRpcV2CborServerProtocol extends RpcServerProtocol {
  private codec = new CborCodec();
  protected serializer = this.codec.createSerializer();
  protected deserializer = this.codec.createDeserializer();

  public constructor(options: { defaultNamespace: string }) {
    super(options);
  }

  public override getShapeId(): string {
    return "smithy.protocols#rpcv2Cbor";
  }

  protected override getDefaultContentType(): string {
    return "application/cbor";
  }

  /**
   * @override - Sets serde context on the codec and serializer/deserializer.
   */
  public override setSerdeContext(serdeContext: any): void {
    super.setSerdeContext(serdeContext);
    this.codec.setSerdeContext(serdeContext);
  }

  /**
   * @override - Validates protocol-specific request headers.
   *
   * Per the spec:
   * - Smithy-Protocol header MUST be present with value "rpc-v2-cbor".
   * - X-Amz-Target and X-Amzn-Target headers MUST NOT be present.
   */
  protected override validateContentType(request: IHttpRequest): void {
    super.validateContentType(request);

    const smithyProtocol = this.getHeaderValue(request, "smithy-protocol");
    if (smithyProtocol !== "rpc-v2-cbor") {
      throw new SerializationException();
    }

    if (this.getHeaderValue(request, "x-amz-target") !== undefined ||
        this.getHeaderValue(request, "x-amzn-target") !== undefined) {
      throw new SerializationException();
    }
  }

  /**
   * @override - Adds the smithy-protocol header to responses.
   */
  protected override async serializeSuccess<Output extends object>(
    operationSchema: any,
    context: any,
    output: Output
  ): Promise<IHttpResponse> {
    const response = await super.serializeSuccess(operationSchema, context, output);
    response.headers["smithy-protocol"] = "rpc-v2-cbor";
    return response;
  }

  /**
   * @override - Adds the smithy-protocol header to error responses.
   */
  protected override async serializeError<E extends Error>(
    operationSchema: any,
    context: any,
    error: E
  ): Promise<IHttpResponse> {
    const response = await super.serializeError(operationSchema, context, error);
    response.headers["smithy-protocol"] = "rpc-v2-cbor";
    return response;
  }

  /**
   * @override - Adds the smithy-protocol header to framework error responses.
   */
  protected override serializeFrameworkException(error: any): IHttpResponse {
    const response = super.serializeFrameworkException(error);
    response.headers["smithy-protocol"] = "rpc-v2-cbor";
    return response;
  }

}
