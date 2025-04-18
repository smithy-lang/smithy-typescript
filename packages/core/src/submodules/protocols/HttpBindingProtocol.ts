import { NormalizedSchema } from "@smithy/core/schema";
import { splitHeader } from "@smithy/core/serde";
import { HttpRequest } from "@smithy/protocol-http";
import type {
  EventStreamSerdeContext,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  SerdeContext,
  StructureSchema,
} from "@smithy/types";
import { sdkStreamMixin } from "@smithy/util-stream";

import { collectBody } from "./collect-stream-body";
import { HttpProtocol } from "./HttpProtocol";

/**
 * @public
 */
export abstract class HttpBindingProtocol extends HttpProtocol {
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
}
