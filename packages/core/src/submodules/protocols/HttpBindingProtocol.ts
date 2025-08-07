import { NormalizedSchema, SCHEMA } from "@smithy/core/schema";
import { splitEvery, splitHeader } from "@smithy/core/serde";
import { HttpRequest } from "@smithy/protocol-http";
import type {
  Endpoint,
  EndpointBearer,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  Schema,
  SerdeFunctions,
} from "@smithy/types";
import { sdkStreamMixin } from "@smithy/util-stream";

import { collectBody } from "./collect-stream-body";
import { extendedEncodeURIComponent } from "./extended-encode-uri-component";
import { HttpProtocol } from "./HttpProtocol";

/**
 * Base for HTTP-binding protocols. Downstream examples
 * include AWS REST JSON and AWS REST XML.
 *
 * @alpha
 */
export abstract class HttpBindingProtocol extends HttpProtocol {
  public async serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    _input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<IHttpRequest> {
    const input: any = {
      ...(_input ?? {}),
    };
    const serializer = this.serializer;
    const query = {} as Record<string, string | string[]>;
    const headers = {} as Record<string, string>;
    const endpoint: Endpoint = await context.endpoint();

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
      this.setHostPrefix(request, operationSchema, input);
      const opTraits = NormalizedSchema.translateTraits(operationSchema.traits);
      if (opTraits.http) {
        request.method = opTraits.http[0];
        const [path, search] = opTraits.http[1].split("?");
        if (request.path == "/") {
          request.path = path;
        } else {
          request.path += path;
        }
        const traitSearchParams = new URLSearchParams(search ?? "");
        Object.assign(query, Object.fromEntries(traitSearchParams));
      }
    }

    for (const [memberName, memberNs] of ns.structIterator()) {
      const memberTraits = memberNs.getMergedTraits() ?? {};
      const inputMemberValue = input[memberName];

      if (inputMemberValue == null) {
        continue;
      }

      if (memberTraits.httpPayload) {
        const isStreaming = memberNs.isStreaming();
        if (isStreaming) {
          const isEventStream = memberNs.isStructSchema();
          if (isEventStream) {
            if (input[memberName]) {
              payload = this.serializeEventStream({
                eventStream: input[memberName],
                unionSchema: memberNs,
              });
            }
          } else {
            // streaming blob body
            payload = inputMemberValue;
          }
        } else {
          // structural/document body
          serializer.write(memberNs, inputMemberValue);
          payload = serializer.flush();
        }
        delete input[memberName];
      } else if (memberTraits.httpLabel) {
        serializer.write(memberNs, inputMemberValue);
        const replacement = serializer.flush() as string;
        if (request.path.includes(`{${memberName}+}`)) {
          request.path = request.path.replace(
            `{${memberName}+}`,
            replacement.split("/").map(extendedEncodeURIComponent).join("/")
          );
        } else if (request.path.includes(`{${memberName}}`)) {
          request.path = request.path.replace(`{${memberName}}`, extendedEncodeURIComponent(replacement));
        }
        delete input[memberName];
      } else if (memberTraits.httpHeader) {
        serializer.write(memberNs, inputMemberValue);
        headers[memberTraits.httpHeader.toLowerCase() as string] = String(serializer.flush());
        delete input[memberName];
      } else if (typeof memberTraits.httpPrefixHeaders === "string") {
        for (const [key, val] of Object.entries(inputMemberValue)) {
          const amalgam = memberTraits.httpPrefixHeaders + key;
          serializer.write([memberNs.getValueSchema(), { httpHeader: amalgam }], val);
          headers[amalgam.toLowerCase()] = serializer.flush() as string;
        }
        delete input[memberName];
      } else if (memberTraits.httpQuery || memberTraits.httpQueryParams) {
        this.serializeQuery(memberNs, inputMemberValue, query);
        delete input[memberName];
      } else {
        hasNonHttpBindingMember = true;
      }
    }

    if (hasNonHttpBindingMember && input) {
      serializer.write(schema, input);
      payload = serializer.flush() as Uint8Array;

      // Due to Smithy validation, we can assume that the members with no HTTP
      // bindings DO NOT contain an event stream.
    }

    request.headers = headers;
    request.query = query;
    request.body = payload;

    return request;
  }

  protected serializeQuery(ns: NormalizedSchema, data: any, query: HttpRequest["query"]) {
    const serializer = this.serializer;
    const traits = ns.getMergedTraits();

    if (traits.httpQueryParams) {
      for (const [key, val] of Object.entries(data)) {
        if (!(key in query)) {
          this.serializeQuery(
            NormalizedSchema.of([
              ns.getValueSchema(),
              {
                // We pass on the traits to the sub-schema
                // because we are still in the process of serializing the map itself.
                ...traits,
                httpQuery: key,
                httpQueryParams: undefined,
              },
            ]),
            val,
            query
          );
        }
      }
      return;
    }

    if (ns.isListSchema()) {
      const sparse = !!ns.getMergedTraits().sparse;
      const buffer = [];
      for (const item of data) {
        // We pass on the traits to the sub-schema
        // because we are still in the process of serializing the list itself.
        serializer.write([ns.getValueSchema(), traits], item);
        const serializable = serializer.flush() as string;
        if (sparse || serializable !== undefined) {
          buffer.push(serializable);
        }
      }
      query[traits.httpQuery as string] = buffer;
    } else {
      serializer.write([ns, traits], data);
      query[traits.httpQuery as string] = serializer.flush() as string;
    }
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
      const bytes: Uint8Array = await collectBody(response.body, context);
      if (bytes.byteLength > 0) {
        Object.assign(dataObject, await deserializer.read(SCHEMA.DOCUMENT, bytes));
      }
      await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
      throw new Error("@smithy/core/protocols - HTTP Protocol error handler failed to throw.");
    }

    for (const header in response.headers) {
      const value = response.headers[header];
      delete response.headers[header];
      response.headers[header.toLowerCase()] = value;
    }

    const nonHttpBindingMembers = await this.deserializeHttpMessage(ns, context, response, dataObject);

    if (nonHttpBindingMembers.length) {
      const bytes: Uint8Array = await collectBody(response.body, context);
      if (bytes.byteLength > 0) {
        const dataFromBody = await deserializer.read(ns, bytes);
        for (const member of nonHttpBindingMembers) {
          dataObject[member] = dataFromBody[member];
        }
      }
      // Due to Smithy validation, we can assume that the members with no HTTP
      // bindings DO NOT contain an event stream.
    }

    dataObject.$metadata = this.deserializeMetadata(response);
    return dataObject;
  }

  /**
   * The base method ignores HTTP bindings.
   *
   * @deprecated (only this signature) use signature without headerBindings.
   * @override
   */
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    headerBindings: Set<string>,
    dataObject: any
  ): Promise<string[]>;
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    dataObject: any
  ): Promise<string[]>;
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    arg4: unknown,
    arg5?: unknown
  ): Promise<string[]> {
    let dataObject: any;
    if (arg4 instanceof Set) {
      dataObject = arg5;
    } else {
      dataObject = arg4;
    }

    const deserializer = this.deserializer;
    const ns = NormalizedSchema.of(schema);
    const nonHttpBindingMembers = [] as string[];

    for (const [memberName, memberSchema] of ns.structIterator()) {
      const memberTraits = memberSchema.getMemberTraits();

      if (memberTraits.httpPayload) {
        const isStreaming = memberSchema.isStreaming();
        if (isStreaming) {
          const isEventStream = memberSchema.isStructSchema();
          if (isEventStream) {
            // event stream (union)
            dataObject[memberName] = this.deserializeEventStream({
              response,
              unionSchema: memberSchema,
            });
          } else {
            // data stream (blob)
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
          if (header.startsWith(memberTraits.httpPrefixHeaders)) {
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
