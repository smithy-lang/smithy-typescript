import type { ServerProtocol } from "./ServerProtocol";
import type {
  ConfigurableSerdeContext,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  $OperationSchema,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
} from "@smithy/types";
import { HttpResponse } from "@smithy/core/protocols";
import type { SmithyFrameworkException } from "../../errors";
import { isFrameworkException } from "../../errors";
import { ServiceException } from "../../errors";
import { NotAcceptableException, UnsupportedMediaTypeException } from "../../errors";
import { acceptMatches } from "../../accept";

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
    operationSchema: $OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    request: IHttpRequest
  ): Promise<Input>;

  /**
   * Serializes the operation output or error into an HTTP response.
   * Inspects the output at runtime to determine if it's an error.
   */
  public async serializeResponse<Output extends object>(
    operationSchema: $OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
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
    operationSchema: $OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    output: Output
  ): Promise<IHttpResponse>;

  /**
   * Serializes an operation error into an HTTP error response.
   * Subclasses implement protocol-specific error serialization logic.
   */
  protected abstract serializeError<E extends Error>(
    operationSchema: $OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
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
  private isOperationError(_operationSchema: $OperationSchema, output: object): boolean {
    const errorName = (output as any).name;
    if (!errorName) {
      return false;
    }
    return (output as any).$fault === "client" || (output as any).$fault === "server";
  }
}
