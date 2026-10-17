import { hasOwn, HttpRequest } from "@smithy/core/transport";
import { NormalizedSchema, type TypeRegistry } from "@smithy/core/schema";
import { sdkStreamMixin, splitEvery, splitHeader } from "@smithy/core/serde";
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
} from "@smithy/types";

import {
  getHttpBindings,
  getHttpOperationBindings,
  type HttpBindingLocation,
  type HttpBindingValue,
  type HttpHeader,
  type HttpLabel,
  type HttpPathSegment,
  type HttpPayload,
  type HttpPrefixHeaders,
  type HttpQuery,
} from "./HttpBindingSchemaExtension";
import { HttpProtocol } from "./HttpProtocol";
import { collectBody } from "./collect-stream-body";
import { extendedEncodeURIComponent } from "./extended-encode-uri-component";
import type { HttpInterceptingShapeDeserializer } from "./serde/HttpInterceptingShapeDeserializer";
import type { HttpInterceptingShapeSerializer } from "./serde/HttpInterceptingShapeSerializer";

type HttpBindingSerializer = Pick<HttpInterceptingShapeSerializer<any>, "writeHttpBinding" | "writeCodec">;
type HttpBindingDeserializer = Pick<
  HttpInterceptingShapeDeserializer<any>,
  "readHttpBinding" | "readPayload" | "readCodec"
>;
type HttpBodyMemberNames = ReturnType<typeof getHttpBindings>["responseBody"];

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
    const query = {} as Record<string, string | string[]>;
    const headers = {} as Record<string, string>;
    const endpoint: Endpoint = await context.endpoint();

    const ns = NormalizedSchema.of(operationSchema?.input);
    const bindings = getHttpBindings(ns);
    const operation = getHttpOperationBindings(operationSchema);

    const request = new HttpRequest({ query, headers });

    if (endpoint) {
      this.updateServiceEndpoint(request, endpoint);
      this.setHostPrefix(request, operationSchema, input, operation);
      const [method, path, staticQuery] = operation;
      if (method) {
        request.method = method;
        request.path = request.path === "/" ? path! : request.path + path!;
        for (const [key, value] of staticQuery) query[key] = value;
      }
    }

    request.query = query;
    const eventStream = this.serializeHttpBindings(input, request, bindings, operation);
    if (eventStream) request.body = await this.serializeEventStream({ eventStream, requestSchema: ns });

    return request;
  }

  private serializeHttpBindings(
    input: any,
    request: HttpRequest,
    bindings: ReturnType<typeof getHttpBindings>,
    operation: ReturnType<typeof getHttpOperationBindings>
  ): AsyncIterable<any> | undefined {
    const serializer = this.serializer;
    const directSerializer =
      "writeCodec" in serializer ? (serializer as typeof serializer & HttpBindingSerializer) : undefined;
    const query = request.query;
    const headers = request.headers;
    const bodySchema = bindings.schema;
    let hasBodyValue = false;
    let payload: any;
    let eventStream: AsyncIterable<any> | undefined;
    let labels: Record<string, string> | undefined;

    const names = Object.getOwnPropertyNames(input);
    const prototype = Object.getPrototypeOf(input);
    const sparse =
      (prototype === Object.prototype || prototype === null) &&
      !bindings.hasIdempotency &&
      bindings.responsePrefixHeaders.length === 0 &&
      names.length * 2 < bindings.length;
    const length = sparse ? names.length : bindings.length;
    for (let i = 0; i < length; ++i) {
      const binding = sparse ? bindings.byName[names[i]] : bindings[i];
      if (!binding) continue;
      const value = binding[1];
      const memberName = binding[0];
      const memberNs = value[0];
      const flags = value[1];
      const collectionValue = value[2];
      const location = binding[2];
      const wireName = binding[3];
      const inputMemberValue = input[memberName];

      if (inputMemberValue == null && !((flags >> 10) & 1)) continue;

      if (location === (0b100_100 satisfies HttpPayload)) {
        const stream = (flags >> 11) & 0b11;
        if (stream) {
          if (stream === 2) eventStream = inputMemberValue || undefined;
          else payload = inputMemberValue;
        } else {
          if (directSerializer) directSerializer.writeCodec(memberNs, inputMemberValue);
          else serializer.write(memberNs, inputMemberValue);
          payload = serializer.flush();
        }
      } else if (location === (0b100_001 satisfies HttpLabel) || location === (0b100_110 satisfies HttpHeader)) {
        const serialized = this.serializeHttpValue(value, inputMemberValue, location, directSerializer);
        if (location === (0b100_001 satisfies HttpLabel)) (labels ??= Object.create(null))[memberName] = serialized;
        else headers[wireName!] = serialized;
      } else if (location === (0b100_111 satisfies HttpPrefixHeaders)) {
        for (const key in inputMemberValue) {
          if (!hasOwn(inputMemberValue, key)) continue;
          const amalgam = wireName! + key;
          headers[amalgam.toLowerCase()] = this.serializeHttpValue(
            collectionValue!,
            inputMemberValue[key],
            0b100_110 satisfies HttpHeader,
            directSerializer,
            directSerializer ? collectionValue![0] : [collectionValue![0], { httpHeader: amalgam }]
          );
        }
      } else if ((location & 0b111_110) === (0b100_010 satisfies HttpQuery)) {
        this.serializeQuery(value, inputMemberValue, wireName, query, directSerializer);
      } else {
        hasBodyValue = true;
      }
    }

    const operationPath = operation[1];
    const pathSegments = operation[3];
    if (operationPath && pathSegments && request.path.endsWith(operationPath)) {
      request.path = request.path.slice(0, -operationPath.length) + this.serializePath(pathSegments, labels, bindings);
    }

    if (hasBodyValue && bodySchema) {
      if (directSerializer) directSerializer.writeCodec(bodySchema, input);
      else serializer.write(bodySchema, input);
      payload = serializer.flush() as Uint8Array;
    }

    request.body = payload;
    return eventStream;
  }

  protected serializeQuery(
    value: HttpBindingValue,
    data: any,
    wireName: string | undefined,
    query: HttpRequest["query"],
    directSerializer?: HttpBindingSerializer
  ) {
    const [ns, flags, collectionValue] = value;
    const traits = directSerializer ? undefined : ns.getMergedTraits();

    if (wireName === undefined) {
      for (const key in data) {
        if (!hasOwn(data, key) || key in query) continue;
        if (!directSerializer) {
          Object.assign(collectionValue![0].getMergedTraits(), {
            ...traits,
            httpQuery: key,
            httpQueryParams: undefined,
          });
        }
        this.serializeQuery(collectionValue!, data[key], key, query, directSerializer);
      }
      return;
    }

    if ((flags & 0b1100_0000) === 0b0100_0000) {
      const buffer = [];
      for (const item of data) {
        const serialized = this.serializeHttpValue(
          collectionValue!,
          item,
          0b100_010 satisfies HttpQuery,
          directSerializer,
          directSerializer ? collectionValue![0] : [collectionValue![0], traits!]
        );
        if ((flags >> 13) & 1 || serialized !== undefined) buffer.push(serialized);
      }
      query[wireName] = buffer;
    } else {
      query[wireName] = this.serializeHttpValue(
        value,
        data,
        0b100_010 satisfies HttpQuery,
        directSerializer,
        directSerializer ? ns : [ns, traits!]
      );
    }
  }

  private serializeHttpValue(
    value: HttpBindingValue,
    data: unknown,
    location: HttpBindingLocation,
    directSerializer?: HttpBindingSerializer,
    schema: Schema = value[0]
  ): string {
    const flags = value[1];
    const type = flags & 0xff;
    if (directSerializer && !(flags & 0x700) && (type < 3 || type === 17 || type === 19)) return String(data);
    if (directSerializer) directSerializer.writeHttpBinding(value, data, location);
    else this.serializer.write(schema, data);
    return this.serializer.flush() as string;
  }

  private serializePath(
    segments: readonly HttpPathSegment[],
    labels: Record<string, string> | undefined,
    bindings: ReturnType<typeof getHttpBindings>
  ): string {
    let path = "";
    for (const [value, kind] of segments) {
      if (kind === 0) {
        path += value;
        continue;
      }
      const replacement = labels?.[value];
      if (replacement === undefined) {
        if (bindings.byName[value]?.[2] === (0b100_001 satisfies HttpLabel)) {
          throw new Error(`No value provided for input HTTP label: ${value}.`);
        }
        path += `{${value}${kind === 2 ? "+" : ""}}`;
      } else {
        path +=
          kind === 2
            ? replacement.split("/").map(extendedEncodeURIComponent).join("/")
            : extendedEncodeURIComponent(replacement);
      }
    }
    return path;
  }

  public async deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse
  ): Promise<Output> {
    const deserializer = this.deserializer;
    const directDeserializer =
      "readCodec" in deserializer ? (deserializer as typeof deserializer & HttpBindingDeserializer) : undefined;
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

    const nonHttpBindingMembers = await this.deserializeHttpMessage(ns, context, response, dataObject);

    if (nonHttpBindingMembers.length) {
      const bytes: Uint8Array = await collectBody(response.body, context);
      if (bytes.byteLength > 0) {
        const dataFromBody = await (directDeserializer
          ? directDeserializer.readCodec(nonHttpBindingMembers.schema!, bytes)
          : deserializer.read(nonHttpBindingMembers.schema!, bytes));
        for (const member of nonHttpBindingMembers) {
          if (dataFromBody[member] != null) dataObject[member] = dataFromBody[member];
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
  ): Promise<HttpBodyMemberNames>;
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    dataObject: any
  ): Promise<HttpBodyMemberNames>;
  protected async deserializeHttpMessage(
    schema: Schema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    arg4: unknown,
    arg5?: unknown
  ): Promise<HttpBodyMemberNames> {
    const dataObject: any = arg4 instanceof Set ? arg5 : arg4;

    const deserializer = this.deserializer;
    const directDeserializer =
      "readCodec" in deserializer ? (deserializer as typeof deserializer & HttpBindingDeserializer) : undefined;
    const ns = NormalizedSchema.of(schema);
    const { responseBody, responsePayload, responseCode, responseHeaders, responsePrefixHeaders } = getHttpBindings(ns);
    const headers = response.headers;

    if (responsePayload) {
      const [memberName, value] = responsePayload;
      const [memberSchema, flags] = value;
      const stream = (flags >> 11) & 0b11;
      if (stream) {
        if (stream === 2) {
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
          dataObject[memberName] = await (directDeserializer
            ? directDeserializer.readPayload(value, bytes)
            : deserializer.read(memberSchema, bytes));
        }
      }
    }

    for (const header in headers) {
      if (!hasOwn(headers, header)) continue;
      const lower = header.toLowerCase();
      const headerValue = headers[header];
      if (lower !== header) {
        delete headers[header];
        headers[lower] = headerValue;
      }
      const binding = responseHeaders[lower];
      if (!binding) continue;
      const [memberName, [memberSchema, flags, collectionValue], , wireName] = binding;
      if (collectionValue) {
        const sections = (flags >> 16) & 1 ? splitEvery(headerValue, ",", 2) : splitHeader(headerValue);
        const list = [];
        for (const section of sections) {
          list.push(
            directDeserializer
              ? directDeserializer.readHttpBinding(collectionValue, section.trim(), 0b100_110 satisfies HttpHeader)
              : await deserializer.read([collectionValue[0], { httpHeader: wireName }], section.trim())
          );
        }
        dataObject[memberName] = list;
      } else {
        dataObject[memberName] = directDeserializer
          ? directDeserializer.readHttpBinding(binding[1], headerValue, 0b100_110 satisfies HttpHeader)
          : await deserializer.read(memberSchema, headerValue);
      }
    }

    for (const [memberName, [, , collectionValue], , wireName] of responsePrefixHeaders) {
      dataObject[memberName] = {};
      for (const header in headers) {
        if (!hasOwn(headers, header)) continue;
        if (!header.startsWith(wireName!)) continue;
        const headerValue = headers[header];
        dataObject[memberName][header.slice(wireName!.length)] = directDeserializer
          ? directDeserializer.readHttpBinding(collectionValue!, headerValue, 0b100_110 satisfies HttpHeader)
          : await deserializer.read([collectionValue![0], { httpHeader: header }], headerValue);
      }
    }

    if (responseCode) dataObject[responseCode[0]] = response.statusCode;

    return responseBody;
  }
}
