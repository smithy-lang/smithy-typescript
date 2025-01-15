import { deref, NormalizedSchema } from "@smithy/core/schema";
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

import { collectBody } from "./collect-stream-body";

export abstract class HttpProtocol implements Protocol<IHttpRequest, IHttpResponse> {
  protected abstract serializer: ShapeSerializer<string | Uint8Array>;
  protected abstract deserializer: ShapeDeserializer;

  public abstract getShapeId(): string;

  public getRequestType(): new (...args: any[]) => IHttpRequest {
    return HttpRequest;
  }

  public getResponseType(): new (...args: any[]) => IHttpResponse {
    return HttpResponse;
  }

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

    let hasPayloadMember = false;
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

    if (operationSchema.traits.http) {
      request.method = operationSchema.traits.http[0];
      const [path, search] = operationSchema.traits.http[1].split("?");

      request.path = path;
      const traitSearchParams = new URLSearchParams(search ?? "");
      Object.assign(query, Object.fromEntries(traitSearchParams));
    }

    for (const memberName of Object.keys(_input)) {
      const memberNs = ns.getMemberSchema(memberName);
      const memberSchema = memberNs.getSchema();
      const memberTraits = memberNs.getMergedTraits();
      const inputMember = (_input as any)[memberName] as any;

      if (memberTraits.httpPayload) {
        hasPayloadMember = true;
        serializer.write([memberSchema, memberTraits], inputMember);
        payload = serializer.flush() as Uint8Array;
      }
      if (memberTraits.httpLabel) {
        serializer.write([memberSchema, memberTraits], inputMember);
        request.path = request.path.replace(`{${memberTraits.httpLabel}}`, serializer.flush() as string);
        delete _input[memberName];
      }
      if (memberTraits.httpHeader) {
        serializer.write([memberSchema, memberTraits], inputMember);
        headers[memberTraits.httpHeader as string] = serializer.flush() as string;
        delete _input[memberName];
      }
      if (memberTraits.httpQuery) {
        serializer.write([memberSchema, memberTraits], inputMember);
        query[memberTraits.httpQuery as string] = serializer.flush() as string;
        delete _input[memberName];
      }
      if (memberTraits.httpPrefixHeaders) {
        for (const [key, val] of Object.entries(inputMember)) {
          const amalgam = memberTraits.httpPrefixHeaders + key;
          serializer.write([, { httpHeader: amalgam }], val);
          headers[amalgam] = serializer.flush() as string;
        }
        delete _input[memberName];
      }
      if (memberTraits.httpQueryParams) {
        for (const [key, val] of Object.entries(inputMember)) {
          serializer.write([, { httpQuery: key }], val);
          query[key] = serializer.flush() as string;
        }
        delete _input[memberName];
      }
    }

    if (!hasPayloadMember && input) {
      serializer.write(schema, _input);
      payload = serializer.flush() as Uint8Array;
    }

    request.headers = headers;
    request.query = query;
    request.body = payload;

    return request;
  }

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

  public async deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext,
    response: IHttpResponse
  ): Promise<Output> {
    const deserializer = this.deserializer;

    let dataObject: any;
    const bytes: Uint8Array = await collectBody(response.body, context as SerdeContext);

    if (response.body && bytes.byteLength > 0) {
      dataObject = await deserializer.read(deref(operationSchema.output), bytes);
    } else {
      dataObject = {};
    }

    const output: Output = {
      $metadata: this.deserializeMetadata(response),
      ...dataObject,
    };

    if (response.statusCode >= 300) {
      await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
    }

    return output;
  }

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
