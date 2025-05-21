import { NormalizedSchema, SCHEMA } from "@smithy/core/schema";
import { splitEvery, splitHeader } from "@smithy/core/serde";
import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import {
  ClientProtocol,
  Codec,
  Endpoint,
  EndpointBearer,
  EndpointV2,
  EventStreamSerdeContext,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  ResponseMetadata,
  Schema,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
} from "@smithy/types";
import { sdkStreamMixin } from "@smithy/util-stream";

import { collectBody } from "./collect-stream-body";

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
        const hostLabelInputs = Object.entries(inputNs.getMemberSchemas()).filter(
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

  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    headerBindings: Set<string>,
    dataObject: any
  ): Promise<string[]> {
    const deserializer = this.deserializer;
    const ns = NormalizedSchema.of(schema);
    const nonHttpBindingMembers = [] as string[];

    for (const [memberName, memberSchema] of Object.entries(ns.getMemberSchemas())) {
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
            const memberSchemas = memberSchema.getMemberSchemas();
            dataObject[memberName] = context.eventStreamMarshaller.deserialize(response.body, async (event) => {
              const unionMember =
                Object.keys(event).find((key) => {
                  return key !== "__type";
                }) ?? "";
              if (unionMember in memberSchemas) {
                const eventStreamSchema = memberSchemas[unionMember];
                return {
                  [unionMember]: await deserializer.read(eventStreamSchema, event[unionMember].body),
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
          const bytes: Uint8Array = await collectBody(response.body, context as SerdeFunctions);
          if (bytes.byteLength > 0) {
            dataObject[memberName] = await deserializer.read(memberSchema, bytes);
          }
        }
      } else if (memberTraits.httpHeader) {
        const key = String(memberTraits.httpHeader).toLowerCase();
        const value = response.headers[key];
        if (null != value) {
          if (memberSchema.isListSchema()) {
            const headerListValueSchema = memberSchema.getValueSchema();
            let sections: string[];
            if (
              headerListValueSchema.isTimestampSchema() &&
              headerListValueSchema.getSchema() === SCHEMA.TIMESTAMP_DEFAULT
            ) {
              sections = splitEvery(value, ",", 2);
            } else {
              sections = splitHeader(value);
            }
            const list = [];
            for (const section of sections) {
              list.push(await deserializer.read([headerListValueSchema, { httpHeader: key }], section.trim()));
            }
            dataObject[memberName] = list;
          } else {
            dataObject[memberName] = await deserializer.read(memberSchema, value);
          }
        }
      } else if (memberTraits.httpPrefixHeaders !== undefined) {
        dataObject[memberName] = {};
        for (const [header, value] of Object.entries(response.headers)) {
          if (!headerBindings.has(header) && header.startsWith(memberTraits.httpPrefixHeaders)) {
            dataObject[memberName][header.slice(memberTraits.httpPrefixHeaders.length)] = await deserializer.read(
              [memberSchema.getValueSchema(), { httpHeader: header }],
              value
            );
          }
        }
      } else if (memberTraits.httpResponseCode) {
        dataObject[memberName] = response.statusCode;
      } else {
        nonHttpBindingMembers.push(memberName);
      }
    }
    return nonHttpBindingMembers;
  }
}
