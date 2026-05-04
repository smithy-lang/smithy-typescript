import { type TypeRegistry, NormalizedSchema } from "@smithy/core/schema";
import type {
  DocumentSchema,
  Endpoint,
  EndpointBearer,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  SerdeFunctions,
} from "@smithy/types";

import { collectBody } from "./collect-stream-body";
import { HttpProtocol } from "./HttpProtocol";
import { HttpRequest } from "./protocol-http/httpRequest";

/**
 * Abstract base for RPC-over-HTTP protocols.
 *
 * @public
 */
export abstract class RpcProtocol extends HttpProtocol {
  /**
   * @override
   */
  protected declare compositeErrorRegistry: TypeRegistry;

  public async serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    _input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<IHttpRequest> {
    const serializer = this.serializer;
    const query = {} as Record<string, string>;
    const headers = {} as Record<string, string>;
    const endpoint: Endpoint = await context.endpoint();

    const ns = NormalizedSchema.of(operationSchema?.input);
    const schema = ns.getSchema();

    let payload: any;
    const input: any = _input && typeof _input === "object" ? _input : {};

    const request = new HttpRequest({
      protocol: "",
      hostname: "",
      port: undefined,
      path: "/",
      fragment: undefined,
      query: query,
      headers: headers,
      body: undefined,
    });

    if (endpoint) {
      this.updateServiceEndpoint(request, endpoint);
      this.setHostPrefix(request, operationSchema, input);
    }

    if (input) {
      const eventStreamMember = ns.getEventStreamMember();

      if (eventStreamMember) {
        if (input[eventStreamMember]) {
          const initialRequest = {} as any;
          for (const [memberName, memberSchema] of ns.structIterator()) {
            if (memberName !== eventStreamMember && input[memberName]) {
              serializer.write(memberSchema, input[memberName]);
              initialRequest[memberName] = serializer.flush();
            }
          }

          payload = await this.serializeEventStream({
            eventStream: input[eventStreamMember],
            requestSchema: ns,
            initialRequest,
          });
        }
      } else {
        serializer.write(schema, input);
        payload = serializer.flush() as Uint8Array;
      }
    }

    request.headers = Object.assign(request.headers, headers);
    request.query = query;
    request.body = payload;
    request.method = "POST";

    return request;
  }

  public async deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse
  ): Promise<Output> {
    const deserializer = this.deserializer;
    const ns = NormalizedSchema.of(operationSchema.output);

    const dataObject: any = {};

    if (response.statusCode >= 300) {
      const bytes: Uint8Array = await collectBody(response.body, context as SerdeFunctions);
      if (bytes.byteLength > 0) {
        Object.assign(dataObject, await deserializer.read(15 satisfies DocumentSchema, bytes));
      }
      await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
      throw new Error("@smithy/core/protocols - RPC Protocol error handler failed to throw.");
    }

    for (const header in response.headers) {
      const value = response.headers[header];
      delete response.headers[header];
      response.headers[header.toLowerCase()] = value;
    }

    const eventStreamMember = ns.getEventStreamMember();
    if (eventStreamMember) {
      dataObject[eventStreamMember] = await this.deserializeEventStream({
        response,
        responseSchema: ns,
        initialResponseContainer: dataObject,
      });
    } else {
      const bytes: Uint8Array = await collectBody(response.body, context as SerdeFunctions);
      if (bytes.byteLength > 0) {
        Object.assign(dataObject, await deserializer.read(ns, bytes));
      }
    }

    dataObject.$metadata = this.deserializeMetadata(response);
    return dataObject;
  }
}
