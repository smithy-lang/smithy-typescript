import { NormalizedSchema, SCHEMA } from "@smithy/core/schema";
import { HttpRequest } from "@smithy/protocol-http";
import type {
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  SerdeContext,
} from "@smithy/types";

import { collectBody } from "./collect-stream-body";
import { HttpProtocol } from "./HttpProtocol";

/**
 * @public
 */
export abstract class RpcProtocol extends HttpProtocol {
  public async serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext
  ): Promise<IHttpRequest> {
    const serializer = this.serializer;
    const query = {} as Record<string, string>;
    const headers = {} as Record<string, string>;
    const endpoint = context.endpointV2;

    const ns = NormalizedSchema.of(operationSchema?.input);
    const schema = ns.getSchema();

    let payload: any;

    const request = new HttpRequest({
      protocol: "",
      hostname: "",
      port: undefined,
      path: "",
      fragment: undefined,
      query: query,
      headers: headers,
      body: undefined,
    });

    if (endpoint) {
      this.updateServiceEndpoint(request, endpoint);
    }

    const _input: any = {
      ...input,
    };

    if (input) {
      serializer.write(schema, _input);
      payload = serializer.flush() as Uint8Array;
    }

    request.headers = headers;
    request.query = query;
    request.body = payload;

    return request;
  }

  public async deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext,
    response: IHttpResponse
  ): Promise<Output> {
    const deserializer = this.deserializer;
    const ns = NormalizedSchema.of(operationSchema.output);

    const dataObject: any = {};

    if (response.statusCode >= 300) {
      const bytes: Uint8Array = await collectBody(response.body, context as SerdeContext);
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

    const bytes: Uint8Array = await collectBody(response.body, context as SerdeContext);
    if (bytes.byteLength > 0) {
      Object.assign(dataObject, await deserializer.read(ns, bytes));
    }

    const output: Output = {
      $metadata: this.deserializeMetadata(response),
      ...dataObject,
    };

    return output;
  }
}
