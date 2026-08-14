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
    const ns = NormalizedSchema.of(operationSchema[4]);
    const eventStreamMember = ns.getEventStreamMember();

    // For event stream operations, the Content-Type is
    // application/vnd.amazon.eventstream, not the protocol's default.
    if (!eventStreamMember) {
      this.validateContentType(request);
      this.validateAccept(request);
    }

    if (ns.getSchema() === "unit") {
      // discard body stream.
      await collectBody(request.body, context);
      return {} as Input;
    }

    if (eventStreamMember) {
      // RPC event stream input: the body is a binary event stream.
      // The initial-request message contains non-stream members.
      const initialRequestContainer: Record<string, any> = {};
      const eventIterable = await this.deserializeEventStream({
        request,
        requestSchema: ns,
        initialRequestContainer,
      });

      const input: any = { ...initialRequestContainer };
      input[eventStreamMember] = eventIterable;
      return input as Input;
    }

    const bytes = await collectBody(request.body, context);

    if (bytes.byteLength === 0) {
      return {} as Input;
    }

    const input = await this.deserializer.read(ns, bytes);
    return (input ?? {}) as Input;
  }

  /**
   * Serializes a successful RPC response.
   *
   * For event stream operations (output has a streaming union member):
   * - The response body is a binary event stream.
   * - The first message is `initial-response` containing non-stream members.
   * - The remaining messages are the event stream from the handler.
   * - The response Content-Type is `application/vnd.amazon.eventstream`.
   */
  protected override async serializeSuccess<Output extends object>(
    operationSchema: StaticOperationSchema,
    _context: SerdeFunctions,
    output: Output
  ): Promise<IHttpResponse> {
    const ns = NormalizedSchema.of(operationSchema[5]);
    const schema = ns.getSchema();

    const eventStreamMember = ns.getEventStreamMember();

    if (eventStreamMember) {
      // RPC event stream output: serialize as binary event stream.
      // Non-stream members go into the initial-response message.
      const eventStream = (output as any)[eventStreamMember] as AsyncIterable<any>;
      if (!eventStream) {
        // No event stream provided by handler — return empty body.
        return new HttpResponse({
          statusCode: 200,
          headers: {
            "content-type": "application/vnd.amazon.eventstream",
          },
          body: undefined,
        });
      }

      // Collect non-stream members for the initial-response.
      const initialResponse: Record<string, any> = {};
      let hasInitialResponse = false;
      for (const [memberName] of ns.structIterator()) {
        if (memberName !== eventStreamMember && (output as any)[memberName] !== undefined) {
          initialResponse[memberName] = (output as any)[memberName];
          hasInitialResponse = true;
        }
      }

      const body = await this.serializeEventStream({
        eventStream,
        responseSchema: ns,
        initialResponse: hasInitialResponse ? initialResponse : undefined,
      });

      return new HttpResponse({
        statusCode: 200,
        headers: {
          "content-type": "application/vnd.amazon.eventstream",
        },
        body,
      });
    }

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
