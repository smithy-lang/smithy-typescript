import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import type {
  EndpointV2,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  Protocol,
  ResponseMetadata,
  SerdeContext,
  ShapeDeserializer,
  ShapeSerializer,
} from "@smithy/types";

/**
 * @public
 */
export abstract class HttpProtocol implements Protocol<IHttpRequest, IHttpResponse> {
  protected abstract serializer: ShapeSerializer<string | Uint8Array>;
  protected abstract deserializer: ShapeDeserializer<string | Uint8Array>;
  protected serdeContext?: SerdeContext;

  public abstract getShapeId(): string;

  public getRequestType(): new (...args: any[]) => IHttpRequest {
    return HttpRequest;
  }

  public getResponseType(): new (...args: any[]) => IHttpResponse {
    return HttpResponse;
  }

  public setSerdeContext(serdeContext: SerdeContext): void {
    this.serdeContext = serdeContext;
    this.serializer.setSerdeContext(serdeContext);
    this.deserializer.setSerdeContext(serdeContext);
  }

  public abstract serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext
  ): Promise<IHttpRequest>;

  public updateServiceEndpoint(request: IHttpRequest, endpoint: EndpointV2) {
    request.protocol = endpoint.url.protocol;
    request.hostname = endpoint.url.hostname;
    request.port = endpoint.url.port ? Number(endpoint.url.port) : undefined;
    request.path = endpoint.url.pathname;
    request.fragment = endpoint.url.hash || void 0;
    request.username = endpoint.url.username || void 0;
    request.password = endpoint.url.password || void 0;

    for (const [k, v] of endpoint.url.searchParams.entries()) {
      if (!request.query) {
        request.query = {};
      }
      request.query[k] = v;
    }

    return request;
  }

  public abstract deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext,
    response: IHttpResponse
  ): Promise<Output>;

  protected abstract handleError(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext,
    response: IHttpResponse,
    dataObject: any,
    metadata: ResponseMetadata
  ): Promise<never>;

  protected deserializeMetadata(output: IHttpResponse): ResponseMetadata {
    return {
      httpStatusCode: output.statusCode,
      requestId:
        output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
      extendedRequestId: output.headers["x-amz-id-2"],
      cfId: output.headers["x-amz-cf-id"],
    };
  }
}
