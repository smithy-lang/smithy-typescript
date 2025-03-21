import { NormalizedSchema } from "@smithy/core/schema";
import { splitHeader } from "@smithy/core/serde";
import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import type {
  EndpointV2,
  EventStreamSerdeContext,
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
  StructureSchema,
} from "@smithy/types";
import { sdkStreamMixin } from "@smithy/util-stream";

import { collectBody } from "./collect-stream-body";

export abstract class HttpProtocol implements Protocol<IHttpRequest, IHttpResponse> {
  protected abstract serializer: ShapeSerializer<string | Uint8Array>;
  protected abstract deserializer: ShapeDeserializer<string | Uint8Array>;
  protected serdeContext?: SerdeContext;

  public abstract getShapeId(): string;

  public getRequestType(): new (...args: any[]) => IHttpRequest {
    return HttpRequest;
  }

  public getResponseType(): new (...args: any[]) => IHttpResponse {
    return HttpResponse;
  }

  public setSerdeContext(serdeContext: SerdeContext): void {
    this.serdeContext = serdeContext;
    this.serializer.setSerdeContext(serdeContext);
    this.deserializer.setSerdeContext(serdeContext);
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

    let hasNonHttpBindingMember = false;
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

    const opTraits = NormalizedSchema.translateTraits(operationSchema.traits);
    if (opTraits.http) {
      request.method = opTraits.http[0];
      const [path, search] = opTraits.http[1].split("?");

      request.path = path;
      const traitSearchParams = new URLSearchParams(search ?? "");
      Object.assign(query, Object.fromEntries(traitSearchParams));
    }

    for (const memberName of Object.keys(_input)) {
      const memberNs = ns.getMemberSchema(memberName);
      if (memberNs === undefined) {
        continue;
      }
      const memberSchema = memberNs.getSchema();
      const memberTraits = memberNs.getMergedTraits();
      const inputMember = (_input as any)[memberName] as any;

      if (memberTraits.httpPayload) {
        const isStreaming = memberNs.isStreaming();
        if (isStreaming) {
          const isEventStream = memberNs.isStructSchema();
          if (isEventStream) {
            // todo(schema)
            throw new Error("serialization of event streams is not yet implemented");
          } else {
            // streaming blob body
            payload = inputMember;
          }
        } else {
          // structural body
          serializer.write([memberSchema, memberTraits], inputMember);
          payload = serializer.flush();
        }
      } else if (memberTraits.httpLabel) {
        serializer.write([memberSchema, memberTraits], inputMember);
        request.path = request.path.replace(`{${memberTraits.httpLabel}}`, serializer.flush() as string);
        delete _input[memberName];
      } else if (memberTraits.httpHeader) {
        serializer.write([memberSchema, memberTraits], inputMember);
        headers[memberTraits.httpHeader.toLowerCase() as string] = String(serializer.flush()).toLowerCase();
        delete _input[memberName];
      } else if (memberTraits.httpQuery) {
        serializer.write([memberSchema, memberTraits], inputMember);
        query[memberTraits.httpQuery as string] = serializer.flush() as string;
        delete _input[memberName];
      } else if (memberTraits.httpPrefixHeaders) {
        for (const [key, val] of Object.entries(inputMember)) {
          const amalgam = memberTraits.httpPrefixHeaders + key;
          serializer.write([0, { httpHeader: amalgam }], val);
          headers[amalgam.toLowerCase()] = String(serializer.flush()).toLowerCase();
        }
        delete _input[memberName];
      } else if (memberTraits.httpQueryParams) {
        for (const [key, val] of Object.entries(inputMember)) {
          serializer.write([0, { httpQuery: key }], val);
          query[key] = serializer.flush() as string;
        }
        delete _input[memberName];
      } else {
        hasNonHttpBindingMember = true;
      }
    }

    if (hasNonHttpBindingMember && input) {
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
    const ns = NormalizedSchema.of(operationSchema.output);
    const schema = ns.getSchema() as StructureSchema;

    let dataObject: any = {};

    if (response.statusCode >= 300) {
      const bytes: Uint8Array = await collectBody(response.body, context as SerdeContext);
      if (bytes.byteLength > 0) {
        Object.assign(dataObject, await deserializer.read(15, bytes));
      }
      await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
      throw new Error("@smithy/core/protocols - HTTP Protocol error handler failed to throw.");
    }

    let hasNonHttpBindingMember = false;

    for (const header in response.headers) {
      const value = response.headers[header];
      delete response.headers[header];
      response.headers[header.toLowerCase()] = value;
    }

    for (const [memberName] of Object.entries(schema?.members ?? {})) {
      const memberSchema = ns.getMemberSchema(memberName);
      if (memberSchema === undefined) {
        continue;
      }
      const memberSchemas = memberSchema.getMemberSchemas();
      const memberTraits = memberSchema.getMemberTraits();

      if (memberTraits.httpPayload) {
        const isStreaming = memberSchema.isStreaming();
        if (isStreaming) {
          const isEventStream = memberSchema.isStructSchema();
          if (isEventStream) {
            // streaming event stream (union)
            const context = this.serdeContext as unknown as EventStreamSerdeContext;
            if (!context.eventStreamMarshaller) {
              throw new Error("@smithy/core - HttpProtocol: eventStreamMarshaller missing in serdeContext.");
            }
            dataObject[memberName] = context.eventStreamMarshaller.deserialize(response.body, async (event) => {
              const unionMember =
                Object.keys(event).find((key) => {
                  return key !== "__type";
                }) ?? "";
              if (unionMember in memberSchemas) {
                const eventStreamSchema = memberSchemas[unionMember];
                return {
                  [unionMember]: deserializer.read(eventStreamSchema, event[unionMember].body),
                };
              } else {
                // this union convention is ignored by the event stream marshaller.
                return {
                  $unknown: event,
                };
              }
            });
          } else {
            // streaming blob body
            dataObject[memberName] = sdkStreamMixin(response.body);
          }
        } else if (response.body) {
          const bytes: Uint8Array = await collectBody(response.body, context as SerdeContext);
          if (bytes.byteLength > 0) {
            dataObject = await deserializer.read(memberSchema, bytes);
          }
        }
      } else if (memberTraits.httpHeader) {
        const key = String(memberTraits.httpHeader).toLowerCase();
        const value = response.headers[key];
        if (ns.isListSchema()) {
          // string list
          dataObject[memberName] = splitHeader(value);
        } else {
          // string
          if (null != value) {
            dataObject[memberName] = await deserializer.read(memberSchema, value);
          }
        }
      } else if (memberTraits.httpPrefixHeaders) {
        dataObject[memberName] = {};
        for (const [header, value] of Object.entries(response.headers)) {
          if (header.startsWith(memberTraits.httpPrefixHeaders)) {
            dataObject[memberName][header.slice(memberTraits.httpPrefixHeaders.length)] = value;
          }
        }
      } else if (memberTraits.httpResponseCode) {
        dataObject[memberName] = response.statusCode;
      } else {
        hasNonHttpBindingMember = true;
      }
    }

    if (hasNonHttpBindingMember) {
      const bytes: Uint8Array = await collectBody(response.body, context as SerdeContext);
      if (bytes.byteLength > 0) {
        Object.assign(dataObject, await deserializer.read(ns, bytes));
      }
    }

    const output: Output = {
      $metadata: this.deserializeMetadata(response),
      ...dataObject,
    };

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
