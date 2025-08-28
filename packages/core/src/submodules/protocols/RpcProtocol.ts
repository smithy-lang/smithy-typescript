import { NormalizedSchema, SCHEMA } from "@smithy/core/schema";
import { HttpRequest } from "@smithy/protocol-http";
import type {
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

/**
 * Abstract base for RPC-over-HTTP protocols.
 *
 * @alpha
 */
export abstract class RpcProtocol extends HttpProtocol {
  public async serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<IHttpRequest> {
    const serializer = this.serializer;
    const query = {} as Record<string, string>;
    const headers = {} as Record<string, string>;
    const endpoint: Endpoint = await context.endpoint();

    const ns = NormalizedSchema.of(operationSchema?.input);
    const schema = ns.getSchema();

    let payload: any;

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

    const _input: any = {
      ...input,
    };

    if (input) {
      const eventStreamMember = ns.getEventStreamMember();

      if (eventStreamMember) {
        if (_input[eventStreamMember]) {
          const initialRequest = {} as any;
          for (const [memberName, memberSchema] of ns.structIterator()) {
            if (memberName !== eventStreamMember && _input[memberName]) {
              serializer.write(memberSchema, _input[memberName]);
              initialRequest[memberName] = serializer.flush();
            }
          }

          payload = await this.serializeEventStream({
            eventStream: _input[eventStreamMember],
            requestSchema: ns,
            initialRequest,
          });
        }
      } else {
        serializer.write(schema, _input);
        payload = serializer.flush() as Uint8Array;
      }
    }

    request.headers = headers;
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
        Object.assign(dataObject, await deserializer.read(SCHEMA.DOCUMENT, bytes));
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
