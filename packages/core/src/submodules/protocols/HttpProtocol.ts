import type { EventStreamSerde } from "@smithy/core/event-streams";
import { NormalizedSchema, translateTraits } from "@smithy/core/schema";
import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import type {
  ClientProtocol,
  Codec,
  Endpoint,
  EndpointBearer,
  EndpointV2,
  EventStreamMarshaller,
  EventStreamSerdeContext,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  ResponseMetadata,
  Schema,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
} from "@smithy/types";

import { SerdeContext } from "./SerdeContext";

/**
 * Abstract base for HTTP-based client protocols.
 *
 * @public
 */
export abstract class HttpProtocol extends SerdeContext implements ClientProtocol<IHttpRequest, IHttpResponse> {
  protected abstract serializer: ShapeSerializer<string | Uint8Array>;
  protected abstract deserializer: ShapeDeserializer<string | Uint8Array>;

  protected constructor(
    public readonly options: {
      defaultNamespace: string;
    }
  ) {
    super();
  }

  public abstract getShapeId(): string;

  public abstract getPayloadCodec(): Codec<any, any>;

  public getRequestType(): new (...args: any[]) => IHttpRequest {
    return HttpRequest;
  }

  public getResponseType(): new (...args: any[]) => IHttpResponse {
    return HttpResponse;
  }

  /**
   * @override
   */
  public setSerdeContext(serdeContext: SerdeFunctions): void {
    this.serdeContext = serdeContext;
    this.serializer.setSerdeContext(serdeContext);
    this.deserializer.setSerdeContext(serdeContext);
    if (this.getPayloadCodec()) {
      this.getPayloadCodec().setSerdeContext(serdeContext);
    }
  }

  public abstract serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<IHttpRequest>;

  public updateServiceEndpoint(request: IHttpRequest, endpoint: EndpointV2 | Endpoint) {
    if ("url" in endpoint) {
      request.protocol = endpoint.url.protocol;
      request.hostname = endpoint.url.hostname;
      request.port = endpoint.url.port ? Number(endpoint.url.port) : undefined;
      request.path = endpoint.url.pathname;
      request.fragment = endpoint.url.hash || void 0;
      request.username = endpoint.url.username || void 0;
      request.password = endpoint.url.password || void 0;
      if (!request.query) {
        request.query = {};
      }
      for (const [k, v] of endpoint.url.searchParams.entries()) {
        request.query[k] = v;
      }
      return request;
    } else {
      request.protocol = endpoint.protocol;
      request.hostname = endpoint.hostname;
      request.port = endpoint.port ? Number(endpoint.port) : undefined;
      request.path = endpoint.path;
      request.query = {
        ...endpoint.query,
      };
      return request;
    }
  }

  public abstract deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse
  ): Promise<Output>;

  protected setHostPrefix<Input extends object>(
    request: IHttpRequest,
    operationSchema: OperationSchema,
    input: Input
  ): void {
    const inputNs = NormalizedSchema.of(operationSchema.input);
    const opTraits = translateTraits(operationSchema.traits ?? {});

    if (opTraits.endpoint) {
      let hostPrefix = opTraits.endpoint?.[0];
      if (typeof hostPrefix === "string") {
        const hostLabelInputs = [...inputNs.structIterator()].filter(
          ([, member]) => member.getMergedTraits().hostLabel
        );
        for (const [name] of hostLabelInputs) {
          const replacement = input[name as keyof typeof input];
          if (typeof replacement !== "string") {
            throw new Error(`@smithy/core/schema - ${name} in input must be a string as hostLabel.`);
          }
          hostPrefix = hostPrefix.replace(`{${name}}`, replacement);
        }
        request.hostname = hostPrefix + request.hostname;
      }
    }
  }

  protected abstract handleError(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
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

  /**
   * @param eventStream - the iterable provided by the caller.
   * @param requestSchema - the schema of the event stream container (struct).
   * @param [initialRequest] - only provided if the initial-request is part of the event stream (RPC).
   *
   * @returns a stream suitable for the HTTP body of a request.
   */
  protected async serializeEventStream({
    eventStream,
    requestSchema,
    initialRequest,
  }: {
    eventStream: AsyncIterable<any>;
    requestSchema: NormalizedSchema;
    initialRequest?: any;
  }): Promise<IHttpRequest["body"]> {
    const eventStreamSerde = await this.loadEventStreamCapability();
    return eventStreamSerde.serializeEventStream({
      eventStream,
      requestSchema,
      initialRequest,
    });
  }

  /**
   * @param response - http response from which to read the event stream.
   * @param unionSchema - schema of the event stream container (struct).
   * @param [initialResponseContainer] - provided and written to only if the initial response is part of the event stream (RPC).
   *
   * @returns the asyncIterable of the event stream.
   */
  protected async deserializeEventStream({
    response,
    responseSchema,
    initialResponseContainer,
  }: {
    response: IHttpResponse;
    responseSchema: NormalizedSchema;
    initialResponseContainer?: any;
  }): Promise<AsyncIterable<{ [key: string]: any; $unknown?: unknown }>> {
    const eventStreamSerde = await this.loadEventStreamCapability();
    return eventStreamSerde.deserializeEventStream({
      response,
      responseSchema,
      initialResponseContainer,
    });
  }

  /**
   * Loads eventStream capability async (for chunking).
   */
  protected async loadEventStreamCapability(): Promise<EventStreamSerde> {
    const { EventStreamSerde } = await import("@smithy/core/event-streams");
    return new EventStreamSerde({
      marshaller: this.getEventStreamMarshaller(),
      serializer: this.serializer,
      deserializer: this.deserializer,
      serdeContext: this.serdeContext,
      defaultContentType: this.getDefaultContentType(),
    });
  }

  /**
   * @returns content-type default header value for event stream events and other documents.
   */
  protected getDefaultContentType(): string {
    throw new Error(
      `@smithy/core/protocols - ${this.constructor.name} getDefaultContentType() implementation missing.`
    );
  }

  /**
   * For HTTP binding protocols, this method is overridden in {@link HttpBindingProtocol}.
   *
   * @deprecated only use this for HTTP binding protocols.
   */
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    headerBindings: Set<string>,
    dataObject: any
  ): Promise<string[]>;
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    dataObject: any
  ): Promise<string[]>;
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    arg4: unknown,
    arg5?: unknown
  ): Promise<string[]> {
    void schema;
    void context;
    void response;
    void arg4;
    void arg5;
    // This method is preserved for backwards compatibility.
    // It should remain unused.
    return [];
  }

  protected getEventStreamMarshaller(): EventStreamMarshaller {
    const context = this.serdeContext as unknown as EventStreamSerdeContext;
    if (!context.eventStreamMarshaller) {
      throw new Error("@smithy/core - HttpProtocol: eventStreamMarshaller missing in serdeContext.");
    }
    return context.eventStreamMarshaller;
  }
}
