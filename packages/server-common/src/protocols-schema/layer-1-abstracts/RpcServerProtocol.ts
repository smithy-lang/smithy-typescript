import { NormalizedSchema } from "@smithy/core/schema";
import { collectBody, HttpResponse } from "@smithy/core/protocols";
import type {
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  SerdeFunctions,
  StaticOperationSchema,
} from "@smithy/types";
import { HttpServerProtocol } from "../layer-0-interface-and-base/HttpServerProtocol";

/**
 * Abstract base for RPC-over-HTTP server protocols.
 *
 * @public
 */
export abstract class RpcServerProtocol extends HttpServerProtocol {
  /**
   * Deserializes an RPC request. The entire input is in the body.
   */
  public override async deserializeRequest<Input extends object>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    request: IHttpRequest
  ): Promise<Input> {
    this.validateContentType(request);
    this.validateAccept(request);

    const ns = NormalizedSchema.of(operationSchema[4]);

    if (ns.getSchema() === "unit") {
      // discard body stream.
      await collectBody(request.body, context);
      return {} as Input;
    }

    const bytes = await collectBody(request.body, context);

    if (bytes.byteLength === 0) {
      return {} as Input;
    }

    const input = await this.deserializer.read(ns, bytes);
    return (input ?? {}) as Input;
  }

  /**
   * Serializes a successful RPC response. The entire output is in the body.
   */
  protected override async serializeSuccess<Output extends object>(
    operationSchema: StaticOperationSchema,
    _context: SerdeFunctions,
    output: Output
  ): Promise<IHttpResponse> {
    const ns = NormalizedSchema.of(operationSchema[5]);
    const schema = ns.getSchema();

    this.serializer.write(schema, output);
    const body = this.serializer.flush();

    return new HttpResponse({
      statusCode: 200,
      headers: {
        "content-type": this.getDefaultContentType(),
      },
      body,
    });
  }

  /**
   * Serializes an operation error as an RPC error response.
   * The error is serialized as a document body with __type discriminator.
   */
  protected override async serializeError<E extends Error>(
    _operationSchema: StaticOperationSchema,
    _context: SerdeFunctions,
    error: E
  ): Promise<IHttpResponse> {
    const errorName = (error as any).name ?? "UnknownError";
    const statusCode = (error as any).statusCode ?? (error as any).$metadata?.httpStatusCode ?? 500;

    const errorBody: Record<string, any> = {
      __type: errorName,
      message: (error as any).message ?? "Unknown error",
    };

    this.serializer.write(15 as any, errorBody); // DocumentSchema = 15
    const body = this.serializer.flush();

    return new HttpResponse({
      statusCode,
      headers: {
        "content-type": this.getDefaultContentType(),
      },
      body,
    });
  }
}
