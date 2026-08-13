import type { ServerProtocol } from "./ServerProtocol";
import type {
  ConfigurableSerdeContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
  StaticOperationSchema,
} from "@smithy/types";
import { HttpResponse } from "@smithy/core/protocols";
import type { NormalizedSchema } from "@smithy/core/schema";
import type { EventStreamSerde } from "@smithy/core/event-streams";
import type { SmithyFrameworkException } from "../../validation/errors";
import { isFrameworkException } from "../../validation/errors";
import { ServiceException } from "../../validation/errors";
import { NotAcceptableException, UnsupportedMediaTypeException } from "../../validation/errors";
import { acceptMatches } from "../../validation/accept";

/**
 * @internal
 */
export class SerdeContextConfig implements ConfigurableSerdeContext {
  protected serdeContext?: SerdeFunctions;

  public setSerdeContext(serdeContext: SerdeFunctions): void {
    this.serdeContext = serdeContext;
  }
}

/**
 * Abstract base for HTTP-based server protocols.
 * Provides shared infrastructure for request deserialization and response serialization.
 *
 * @public
 */
export abstract class HttpServerProtocol
  extends SerdeContextConfig
  implements ServerProtocol<IHttpRequest, IHttpResponse>
{
  protected abstract serializer: ShapeSerializer<Uint8Array>;
  protected abstract deserializer: ShapeDeserializer<Uint8Array>;

  protected constructor(
    protected readonly options: {
      defaultNamespace: string;
    }
  ) {
    super();
  }

  public abstract getShapeId(): string;

  /**
   * @returns the content-type this protocol uses for request/response bodies.
   */
  protected abstract getDefaultContentType(): string;

  public override setSerdeContext(serdeContext: SerdeFunctions): void {
    this.serdeContext = serdeContext;
    this.serializer.setSerdeContext(serdeContext);
    this.deserializer.setSerdeContext(serdeContext);
  }

  public abstract deserializeRequest<Input extends object>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    request: IHttpRequest
  ): Promise<Input>;

  /**
   * Serializes the operation output or error into an HTTP response.
   * Inspects the output at runtime to determine if it's an error.
   */
  public async serializeResponse<Output extends object>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    output: Output
  ): Promise<IHttpResponse> {
    if (isFrameworkException(output)) {
      return this.serializeFrameworkException(output as unknown as SmithyFrameworkException);
    }

    if (output instanceof ServiceException || this.isOperationError(operationSchema, output)) {
      return this.serializeError(operationSchema, context, output as unknown as Error);
    }

    return this.serializeSuccess(operationSchema, context, output);
  }

  /**
   * Serializes a successful operation output into an HTTP response.
   * Subclasses implement protocol-specific serialization logic.
   */
  protected abstract serializeSuccess<Output extends object>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    output: Output
  ): Promise<IHttpResponse>;

  /**
   * Serializes an operation error into an HTTP error response.
   * Subclasses implement protocol-specific error serialization logic.
   */
  protected abstract serializeError<E extends Error>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    error: E
  ): Promise<IHttpResponse>;

  /**
   * Serializes a framework-level exception (e.g., UnsupportedMediaTypeException).
   */
  protected serializeFrameworkException(error: SmithyFrameworkException): IHttpResponse {
    const errorBody = {
      __type: error.name,
      message: (error as any).message ?? error.name,
    };

    this.serializer.write(15 as any, errorBody);
    const body = this.serializer.flush();

    return new HttpResponse({
      statusCode: error.statusCode,
      headers: {
        "content-type": this.getDefaultContentType(),
      },
      body,
    });
  }

  /**
   * Gets a header value from a request by case-insensitive name.
   */
  protected getHeaderValue(request: IHttpRequest, name: string): string | undefined {
    const key = Object.keys(request.headers).find((k) => k.toLowerCase() === name);
    return key != null ? request.headers[key] : undefined;
  }

  /**
   * Validates the Content-Type header matches this protocol's expected content type.
   */
  protected validateContentType(request: IHttpRequest): void {
    const contentType = this.getHeaderValue(request, "content-type");
    if (contentType !== undefined && contentType !== this.getDefaultContentType()) {
      throw new UnsupportedMediaTypeException();
    }
  }

  /**
   * Validates the Accept header is compatible with this protocol's response content type.
   */
  protected validateAccept(request: IHttpRequest): void {
    const accept = this.getHeaderValue(request, "accept");
    if (accept !== undefined && !acceptMatches(accept, this.getDefaultContentType())) {
      throw new NotAcceptableException();
    }
  }

  /**
   * Determines if the output value is one of the operation's modeled errors.
   */
  private isOperationError(_operationSchema: StaticOperationSchema, output: object): boolean {
    const errorName = (output as any).name;
    if (!errorName) {
      return false;
    }
    return (output as any).$fault === "client" || (output as any).$fault === "server";
  }

  /**
   * Serializes an AsyncIterable of events into a binary event stream body.
   *
   * @param eventStream - the iterable of events provided by the handler.
   * @param responseSchema - the schema of the output structure containing the event stream member.
   * @param initialResponse - for RPC protocols, non-stream members serialized as initial-response.
   *
   * @returns an AsyncIterable of Uint8Array chunks suitable for the HTTP response body.
   *
   * @internal
   */
  protected async serializeEventStream({
    eventStream,
    responseSchema,
    initialResponse,
  }: {
    eventStream: AsyncIterable<any>;
    responseSchema: NormalizedSchema;
    initialResponse?: any;
  }): Promise<AsyncIterable<Uint8Array>> {
    const eventStreamSerde = await this.loadEventStreamCapability();
    // Reuse serializeEventStream which produces a marshalled binary stream.
    // Pass initialMessageType="initial-response" because on the server we
    // emit the initial message as a response, not a request.
    const body = await eventStreamSerde.serializeEventStream({
      eventStream,
      requestSchema: responseSchema,
      initialRequest: initialResponse,
      initialMessageType: "initial-response",
    });
    return body as AsyncIterable<Uint8Array>;
  }

  /**
   * Deserializes a binary event stream body into an AsyncIterable of typed events.
   *
   * @param request - the HTTP request whose body contains the event stream.
   * @param requestSchema - the schema of the input structure containing the event stream member.
   * @param initialRequestContainer - for RPC protocols, populated with initial-request members.
   *
   * @returns the AsyncIterable of deserialized events.
   *
   * @internal
   */
  protected async deserializeEventStream({
    request,
    requestSchema,
    initialRequestContainer,
  }: {
    request: IHttpRequest;
    requestSchema: NormalizedSchema;
    initialRequestContainer?: any;
  }): Promise<AsyncIterable<any>> {
    const eventStreamSerde = await this.loadEventStreamCapability();
    // Reuse deserializeEventStream. It operates on an IHttpResponse shape
    // but only reads `.body`, so we can adapt the request body.
    // Pass initialMessageType="initial-request" because on the server we
    // receive the initial message as a request, not a response.
    const pseudoResponse = new HttpResponse({
      statusCode: 200,
      headers: {},
      body: request.body,
    });
    return eventStreamSerde.deserializeEventStream({
      response: pseudoResponse,
      responseSchema: requestSchema,
      initialResponseContainer: initialRequestContainer,
      initialMessageType: "initial-request",
    });
  }

  /**
   * Lazily loads the EventStreamSerde capability.
   *
   * @internal
   */
  private async loadEventStreamCapability(): Promise<EventStreamSerde> {
    const { EventStreamSerde, UniversalEventStreamMarshaller } = await import("@smithy/core/event-streams");
    const { fromUtf8, toUtf8 } = await import("@smithy/core/serde");
    const marshaller = new UniversalEventStreamMarshaller({
      utf8Encoder: this.serdeContext?.utf8Encoder ?? toUtf8,
      utf8Decoder: this.serdeContext?.utf8Decoder ?? fromUtf8,
    });
    return new EventStreamSerde({
      marshaller,
      serializer: this.serializer as ShapeSerializer<string | Uint8Array>,
      deserializer: this.deserializer as ShapeDeserializer<string | Uint8Array>,
      serdeContext: this.serdeContext,
      defaultContentType: this.getDefaultContentType(),
    });
  }
}
