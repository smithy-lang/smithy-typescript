import { hasOwn } from "@smithy/core/transport";
import { NormalizedSchema, translateTraits, type TypeRegistry } from "@smithy/core/schema";
import { sdkStreamMixin, splitEvery, splitHeader } from "@smithy/core/serde";
import { HttpRequest } from "@smithy/core/transport";
import type {
  DocumentSchema,
  Endpoint,
  EndpointBearer,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  MetadataBearer,
  OperationSchema,
  Schema,
  SerdeFunctions,
  StaticStructureSchema,
  TimestampDefaultSchema,
} from "@smithy/types";

import {
  getHttpBindings,
  type HttpBody,
  type HttpHeader,
  type HttpLabel,
  type HttpPayload,
  type HttpPrefixHeaders,
  type HttpQuery,
  type HttpQueryParams,
  type HttpResponseCode,
} from "./HttpBindingSchemaExtension";
import { HttpProtocol } from "./HttpProtocol";
import { collectBody } from "./collect-stream-body";
import { extendedEncodeURIComponent } from "./extended-encode-uri-component";

/**
 * Base for HTTP-binding protocols. Downstream examples
 * include AWS REST JSON and AWS REST XML.
 *
 * @public
 */
export abstract class HttpBindingProtocol extends HttpProtocol {
  /**
   * @override
   */
  declare protected compositeErrorRegistry: TypeRegistry;

  public async serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    _input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<IHttpRequest> {
    const input: any = _input && typeof _input === "object" ? _input : {};
    const serializer = this.serializer;
    const query = {} as Record<string, string | string[]>;
    const headers = {} as Record<string, string>;
    const endpoint: Endpoint = await context.endpoint();

    const ns = NormalizedSchema.of(operationSchema?.input);
    const payloadMemberNames: StaticStructureSchema[4] = [];
    const payloadMemberSchemas: StaticStructureSchema[5] = [];

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
      const opTraits = translateTraits(operationSchema.traits);
      if (opTraits.http) {
        request.method = opTraits.http[0];
        const [path, search] = opTraits.http[1].split("?");
        if (request.path == "/") {
          request.path = path;
        } else {
          request.path += path;
        }
        const traitSearchParams = new URLSearchParams(search ?? "");
        for (const [key, value] of traitSearchParams) {
          query[key] = value;
        }
      }
    }

    for (const [memberName, memberNs, location, wireName] of getHttpBindings(ns)) {
      const inputMemberValue = input[memberName];

      if (inputMemberValue == null && !memberNs.isIdempotencyToken()) {
        if (location === (3 satisfies HttpLabel)) {
          // at this point, we have a modeled httpLabel which has no input value.
          // We only throw if the request URI has a corresponding unfulfilled label.
          // It would be unusual for the request path not to contain the label, perhaps a modeling
          // error, but best to be conservative about throwing.
          if (request.path.includes(`{${memberName}+}`) || request.path.includes(`{${memberName}}`)) {
            throw new Error(`No value provided for input HTTP label: ${memberName}.`);
          }
        }
        continue;
      }

      if (location === (4 satisfies HttpPayload)) {
        const isStreaming = memberNs.isStreaming();
        if (isStreaming) {
          const isEventStream = memberNs.isStructSchema();
          if (isEventStream) {
            // event stream (union)
            // initial-request is handled by other HTTP bindings.
            // no additional handling is needed here.
            if (input[memberName]) {
              payload = await this.serializeEventStream({
                eventStream: input[memberName],
                requestSchema: ns,
              });
            }
          } else {
            // data stream (blob)
            payload = inputMemberValue;
          }
        } else {
          // structural/document body
          serializer.write(memberNs, inputMemberValue);
          payload = serializer.flush();
        }
      } else if (location === (3 satisfies HttpLabel)) {
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
      } else if (location === (1 satisfies HttpHeader)) {
        serializer.write(memberNs, inputMemberValue);
        headers[wireName!] = String(serializer.flush());
      } else if (location === (5 satisfies HttpPrefixHeaders)) {
        for (const key in inputMemberValue) {
          if (!hasOwn(inputMemberValue, key)) continue;
          const val = inputMemberValue[key];
          const amalgam = wireName! + key;
          serializer.write([memberNs.getValueSchema(), { httpHeader: amalgam }], val);
          headers[amalgam.toLowerCase()] = serializer.flush() as string;
        }
      } else if (location === (2 satisfies HttpQuery) || location === (6 satisfies HttpQueryParams)) {
        this.serializeQuery(memberNs, inputMemberValue, query);
      } else {
        hasNonHttpBindingMember = true;
        payloadMemberNames.push(memberName);
        payloadMemberSchemas.push(memberNs);
      }
    }

    if (hasNonHttpBindingMember && input) {
      const [namespace, name] = (ns.getName(true) ?? "#Unknown").split("#");
      const requiredMembers = (ns.getSchema() as StaticStructureSchema)[6];
      const payloadSchema = [
        3,
        namespace,
        name,
        ns.getMergedTraits(),
        payloadMemberNames,
        payloadMemberSchemas,
        undefined as number | undefined,
      ] satisfies StaticStructureSchema;
      if (requiredMembers) {
        payloadSchema[6] = requiredMembers;
      } else {
        payloadSchema.pop();
      }

      serializer.write(payloadSchema, input);
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
      for (const key in data) {
        if (!hasOwn(data, key)) continue;
        if (!(key in query)) {
          const val = data[key];
          const valueSchema = ns.getValueSchema();
          Object.assign(valueSchema.getMergedTraits(), {
            // We pass on the traits to the sub-schema
            // because we are still in the process of serializing the map itself.
            ...traits,
            httpQuery: key,
            httpQueryParams: undefined,
          });
          this.serializeQuery(valueSchema, val, query);
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
        Object.assign(dataObject, await deserializer.read(15 satisfies DocumentSchema, bytes));
      }
      await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
      throw new Error("@smithy/core/protocols - HTTP Protocol error handler failed to throw.");
    }

    for (const header in response.headers) {
      if (!hasOwn(response.headers, header)) continue;
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
          if (dataFromBody[member] != null) {
            dataObject[member] = dataFromBody[member];
          }
        }
      }
      // Due to Smithy validation, we can assume that the members with no HTTP
      // bindings DO NOT contain an event stream.
    } else if (nonHttpBindingMembers.discardResponseBody) {
      await collectBody(response.body, context);
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
  ): Promise<string[] & { discardResponseBody?: boolean }>;
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    dataObject: any
  ): Promise<string[] & { discardResponseBody?: boolean }>;
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    arg4: unknown,
    arg5?: unknown
  ): Promise<string[] & { discardResponseBody?: boolean }> {
    let dataObject: any;
    if (arg4 instanceof Set) {
      dataObject = arg5;
    } else {
      dataObject = arg4;
    }

    let discardResponseBody = true;
    const deserializer = this.deserializer;
    const ns = NormalizedSchema.of(schema);
    const nonHttpBindingMembers = [] as string[] & { discardResponseBody?: boolean };

    for (const [memberName, memberSchema, location, wireName] of getHttpBindings(ns)) {
      if (location === (4 satisfies HttpPayload)) {
        discardResponseBody = false;
        const isStreaming = memberSchema.isStreaming();
        if (isStreaming) {
          const isEventStream = memberSchema.isStructSchema();
          if (isEventStream) {
            // event stream (union)
            // initial-response is handled by other HTTP bindings.
            dataObject[memberName] = await this.deserializeEventStream({
              response,
              responseSchema: ns,
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
      } else if (location === (1 satisfies HttpHeader)) {
        const value = response.headers[wireName!];
        if (null != value) {
          if (memberSchema.isListSchema()) {
            const headerListValueSchema = memberSchema.getValueSchema();
            headerListValueSchema.getMergedTraits().httpHeader = wireName;
            let sections: string[];
            if (
              headerListValueSchema.isTimestampSchema() &&
              headerListValueSchema.getSchema() === (4 satisfies TimestampDefaultSchema)
            ) {
              sections = splitEvery(value, ",", 2);
            } else {
              sections = splitHeader(value);
            }
            const list = [];
            for (const section of sections) {
              list.push(await deserializer.read(headerListValueSchema, section.trim()));
            }
            dataObject[memberName] = list;
          } else {
            dataObject[memberName] = await deserializer.read(memberSchema, value);
          }
        }
      } else if (location === (5 satisfies HttpPrefixHeaders)) {
        dataObject[memberName] = {};
        for (const header in response.headers) {
          if (!hasOwn(response.headers, header)) continue;
          if (header.startsWith(wireName!)) {
            const value = response.headers[header];
            const valueSchema = memberSchema.getValueSchema();
            valueSchema.getMergedTraits().httpHeader = header;
            dataObject[memberName][header.slice(wireName!.length)] = await deserializer.read(valueSchema, value);
          }
        }
      } else if (location === (7 satisfies HttpResponseCode)) {
        dataObject[memberName] = response.statusCode;
      } else if (
        location === (0 satisfies HttpBody) ||
        location === (2 satisfies HttpQuery) ||
        location === (3 satisfies HttpLabel) ||
        location === (6 satisfies HttpQueryParams)
      ) {
        nonHttpBindingMembers.push(memberName);
      }
    }
    nonHttpBindingMembers.discardResponseBody = discardResponseBody;
    return nonHttpBindingMembers;
  }
}
