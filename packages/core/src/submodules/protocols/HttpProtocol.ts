import { NormalizedSchema } from "@smithy/core/schema";
import { SCHEMA } from "@smithy/core/schema";
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
  Message as EventStreamMessage,
  MessageHeaders,
  MessageHeaderValue,
  MetadataBearer,
  OperationSchema,
  ResponseMetadata,
  Schema,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
} from "@smithy/types";
import { fromUtf8 } from "@smithy/util-utf8";

/**
 * Abstract base for HTTP-based client protocols.
 *
 * @alpha
 */
export abstract class HttpProtocol implements ClientProtocol<IHttpRequest, IHttpResponse> {
  protected abstract serializer: ShapeSerializer<string | Uint8Array>;
  protected abstract deserializer: ShapeDeserializer<string | Uint8Array>;
  protected serdeContext?: SerdeFunctions;

  protected constructor(
    public readonly options: {
      defaultNamespace: string;
    }
  ) {}

  public abstract getShapeId(): string;

  public abstract getPayloadCodec(): Codec<any, any>;

  public getRequestType(): new (...args: any[]) => IHttpRequest {
    return HttpRequest;
  }

  public getResponseType(): new (...args: any[]) => IHttpResponse {
    return HttpResponse;
  }

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
      for (const [k, v] of endpoint.url.searchParams.entries()) {
        if (!request.query) {
          request.query = {};
        }
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
    const operationNs = NormalizedSchema.of(operationSchema);
    const inputNs = NormalizedSchema.of(operationSchema.input);
    if (operationNs.getMergedTraits().endpoint) {
      let hostPrefix = operationNs.getMergedTraits().endpoint?.[0];
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
   * @returns a stream suitable for the HTTP body of a request.
   */
  protected serializeEventStream({
    eventStream,
    unionSchema,
  }: {
    eventStream: AsyncIterable<any>;
    unionSchema: NormalizedSchema;
  }): IHttpRequest["body"] {
    const marshaller = this.getEventStreamMarshaller();
    const memberSchemas = unionSchema.getMemberSchemas();

    return marshaller.serialize(eventStream, (event: any): EventStreamMessage => {
      const unionMember =
        Object.keys(event).find((key) => {
          return key !== "__type";
        }) ?? "";
      const eventStreamSchema = memberSchemas[unionMember] ?? NormalizedSchema.of(SCHEMA.DOCUMENT);

      let messageSerialization: string | Uint8Array;
      let eventType = unionMember;

      if (eventStreamSchema.isStructSchema()) {
        this.serializer.write(eventStreamSchema, event[unionMember]);
        messageSerialization = this.serializer.flush();
      } else {
        // $unknown member
        const [type, value] = event[unionMember];
        eventType = type;
        this.serializer.write(NormalizedSchema.of(SCHEMA.DOCUMENT), value);
        messageSerialization = this.serializer.flush();
      }

      const body =
        typeof messageSerialization === "string"
          ? (this.serdeContext?.utf8Decoder ?? fromUtf8)(messageSerialization)
          : messageSerialization;

      const headers: MessageHeaders = {
        ":event-type": { type: "string", value: eventType },
        ":message-type": { type: "string", value: "event" },
        ":content-type": { type: "string", value: this.getDefaultContentType() },
      };

      // additional trait-annotated event headers.
      if (eventStreamSchema.isStructSchema()) {
        for (const [memberName, memberSchema] of eventStreamSchema.structIterator()) {
          const isHeader = !!memberSchema.getMergedTraits().eventHeader;
          if (!isHeader) {
            continue;
          }
          const value = event[memberName];
          let type = "binary" as MessageHeaderValue["type"];
          if (memberSchema.isNumericSchema()) {
            if ((-2) ** 31 <= value && value <= 2 ** 31 - 1) {
              type = "integer";
            } else {
              type = "long";
            }
          } else if (memberSchema.isTimestampSchema()) {
            type = "timestamp";
          } else if (memberSchema.isStringSchema()) {
            type = "string";
          } else if (memberSchema.isBooleanSchema()) {
            type = "boolean";
          }

          if (isHeader && value != undefined) {
            headers[memberName] = {
              type,
              value,
            };
          }
        }
      }

      return {
        headers,
        body,
      };
    });
  }

  /**
   * @returns the asyncIterable of the event stream.
   */
  protected deserializeEventStream({
    response,
    unionSchema,
  }: {
    response: IHttpResponse;
    unionSchema: NormalizedSchema;
  }): AsyncIterable<{ [key: string]: any; $unknown?: unknown }> {
    const marshaller = this.getEventStreamMarshaller();
    const memberSchemas = unionSchema.getMemberSchemas();

    return marshaller.deserialize(response.body, async (event) => {
      const unionMember =
        Object.keys(event).find((key) => {
          return key !== "__type";
        }) ?? "";

      if (unionMember in memberSchemas) {
        const eventStreamSchema = memberSchemas[unionMember];
        return {
          [unionMember]: await this.deserializer.read(eventStreamSchema, event[unionMember].body),
        };
      } else {
        // todo(schema): This union convention is ignored by the event stream marshaller.
        // todo(schema): This should be returned to the user instead.
        // see "if (deserialized.$unknown) return;" in getUnmarshalledStream.ts
        return {
          $unknown: event,
        };
      }
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
