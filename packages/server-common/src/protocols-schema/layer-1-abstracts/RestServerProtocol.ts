import { NormalizedSchema, translateTraits } from "@smithy/core/schema";
import { collectBody, type FromStringShapeDeserializer, HttpResponse } from "@smithy/core/protocols";
import type {
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  SerdeFunctions,
  StaticOperationSchema,
} from "@smithy/types";
import { HttpServerProtocol } from "../layer-0-interface-and-base/HttpServerProtocol";

/**
 * Abstract base for REST (HTTP binding) server protocols.
 *
 * @public
 */
export abstract class RestServerProtocol extends HttpServerProtocol {
  /**
   * Deserializer for string-encoded values (headers, query params, path labels).
   */
  protected abstract stringDeserializer: FromStringShapeDeserializer;

  /**
   * Deserializes a REST request. Input members are bound across
   * HTTP path, query, headers, and body.
   */
  public override async deserializeRequest<Input extends object>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    request: IHttpRequest
  ): Promise<Input> {
    const ns = NormalizedSchema.of(operationSchema[4]);

    // Only validate Content-Type and Accept when the body will be parsed
    // as the protocol's document format. When @httpPayload targets a blob
    // or string, the wire content type is determined by the media and is
    // not constrained to the protocol's default.
    if (this.bodyIsDocument(ns)) {
      this.validateContentType(request);
      this.validateAccept(request);
    }
    const callerInput: any = {};

    // Extract path labels by building a regex from the operation's URI template.
    const pathLabels = this.extractPathLabels(operationSchema, request.path);
    Object.assign(callerInput, pathLabels);

    for (const [memberName, memberSchema] of ns.structIterator()) {
      const traits = memberSchema.getMergedTraits();

      if (traits.httpLabel) {
        // Already extracted above from the path; convert from string to typed value.
        if (callerInput[memberName] != null) {
          callerInput[memberName] = this.stringDeserializer.read(memberSchema, callerInput[memberName]);
        }
      } else if (traits.httpQuery) {
        // Extract from query string and deserialize from string representation.
        const queryKey = typeof traits.httpQuery === "string" ? traits.httpQuery : memberName;
        const queryValue = request.query?.[queryKey];
        if (queryValue != null) {
          if (Array.isArray(queryValue)) {
            // Repeated query params represent a list — deserialize each element.
            callerInput[memberName] = queryValue.map((item) =>
              this.stringDeserializer.read(
                memberSchema.isListSchema() ? memberSchema.getValueSchema() : memberSchema,
                item
              )
            );
          } else {
            callerInput[memberName] = this.stringDeserializer.read(memberSchema, queryValue);
          }
        }
      } else if (traits.httpHeader) {
        // Extract from headers and deserialize from string representation.
        const headerName = (typeof traits.httpHeader === "string" ? traits.httpHeader : memberName).toLowerCase();
        const headerValue = request.headers[headerName];
        if (headerValue !== undefined) {
          callerInput[memberName] = this.stringDeserializer.read(memberSchema, headerValue);
        }
      } else if (traits.httpPrefixHeaders) {
        // Extract prefix headers and deserialize each value.
        const prefix = (typeof traits.httpPrefixHeaders === "string" ? traits.httpPrefixHeaders : "").toLowerCase();
        const map: Record<string, any> = {};
        const valueSchema = memberSchema.getValueSchema();
        for (const [key, value] of Object.entries(request.headers)) {
          if (key.toLowerCase().startsWith(prefix)) {
            map[key.slice(prefix.length)] = this.stringDeserializer.read(valueSchema, value);
          }
        }
        if (Object.keys(map).length > 0) {
          callerInput[memberName] = map;
        }
      } else if (traits.httpPayload) {
        // This member is the entire body.
        if (memberSchema.isStreaming()) {
          if (memberSchema.isStructSchema()) {
            // Event stream (streaming union).
            // In REST protocols, initial-request members are bound to HTTP
            // headers/URI/query — they are NOT part of the event stream.
            callerInput[memberName] = await this.deserializeEventStream({
              request,
              requestSchema: ns,
            });
          } else {
            // Data stream (streaming blob) — pass body through to the handler.
            callerInput[memberName] = request.body;
          }
        } else if (memberSchema.isBlobSchema()) {
          callerInput[memberName] = await collectBody(request.body, context);
        } else {
          const bytes = await collectBody(request.body, context);
          if (bytes.byteLength > 0) {
            callerInput[memberName] = await this.deserializer.read(memberSchema, bytes);
          }
        }
      }
      // Remaining members without HTTP bindings are part of the document body
      // and handled below.
    }

    // Deserialize non-bound members from the body (if any exist and no @httpPayload was used).
    const hasPayloadMember = Array.from(ns.structIterator()).some(([, m]) => m.getMergedTraits().httpPayload);
    if (!hasPayloadMember) {
      // Collect the names of members that have no HTTP binding trait.
      const nonBoundMembers: string[] = [];
      for (const [memberName, memberSchema] of ns.structIterator()) {
        const t = memberSchema.getMergedTraits();
        if (
          !t.httpLabel &&
          !t.httpQuery &&
          !t.httpQueryParams &&
          !t.httpHeader &&
          !t.httpPrefixHeaders &&
          !t.httpPayload &&
          !t.httpResponseCode
        ) {
          nonBoundMembers.push(memberName);
        }
      }
      if (nonBoundMembers.length > 0) {
        const bytes = await collectBody(request.body, context);
        if (bytes.byteLength > 0) {
          const bodyData = await this.deserializer.read(ns, bytes);
          for (const member of nonBoundMembers) {
            if (bodyData[member] != null) {
              callerInput[member] = bodyData[member];
            }
          }
        }
      }
    }

    return callerInput as Input;
  }

  /**
   * Serializes a successful REST response. Output members are distributed
   * across HTTP status, headers, and body based on binding traits.
   */
  protected override async serializeSuccess<Output extends object>(
    operationSchema: StaticOperationSchema,
    _context: SerdeFunctions,
    output: Output
  ): Promise<IHttpResponse> {
    const ns = NormalizedSchema.of(operationSchema[5]);
    const headers: Record<string, string> = {};
    let statusCode = 200;
    let body: Uint8Array | ReadableStream | undefined;
    let payloadMember: string | undefined;

    for (const [memberName, memberSchema] of ns.structIterator()) {
      const traits = memberSchema.getMergedTraits();
      const value = (output as any)[memberName];

      if (value == null) {
        continue;
      }

      if (traits.httpResponseCode) {
        statusCode = value;
      } else if (traits.httpHeader) {
        const headerName = typeof traits.httpHeader === "string" ? traits.httpHeader : memberName;
        headers[headerName.toLowerCase()] = String(value);
      } else if (traits.httpPrefixHeaders) {
        const prefix = typeof traits.httpPrefixHeaders === "string" ? traits.httpPrefixHeaders : "";
        for (const [key, val] of Object.entries(value as Record<string, string>)) {
          headers[(prefix + key).toLowerCase()] = val;
        }
      } else if (traits.httpPayload) {
        payloadMember = memberName;
        if (memberSchema.isStreaming()) {
          if (memberSchema.isStructSchema()) {
            // Event stream (streaming union).
            // In REST protocols, initial-response members are bound to HTTP
            // headers — they are NOT part of the event stream.
            const eventIterable = value as AsyncIterable<any>;
            const eventBody = await this.serializeEventStream({
              eventStream: eventIterable,
              responseSchema: ns,
            });
            body = eventBody as any;
            headers["content-type"] = "application/vnd.amazon.eventstream";
          } else {
            // Data stream (streaming blob) — pass through to the response body.
            body = value;
          }
        } else if (memberSchema.isBlobSchema()) {
          body = value;
        } else {
          this.serializer.write(memberSchema.getSchema(), value);
          body = this.serializer.flush();
          headers["content-type"] = this.getDefaultContentType();
        }
      }
    }

    // If no explicit @httpPayload, serialize remaining document body members.
    if (!payloadMember) {
      const bodyObject: any = {};
      let hasBody = false;
      for (const [memberName, memberSchema] of ns.structIterator()) {
        const traits = memberSchema.getMergedTraits();
        if (!traits.httpHeader && !traits.httpPrefixHeaders && !traits.httpResponseCode && !traits.httpPayload) {
          const value = (output as any)[memberName];
          if (value !== undefined) {
            bodyObject[memberName] = value;
            hasBody = true;
          }
        }
      }
      if (hasBody) {
        const schema = ns.getSchema();
        this.serializer.write(schema, bodyObject);
        body = this.serializer.flush();
        headers["content-type"] = this.getDefaultContentType();
      }
    }

    return new HttpResponse({
      statusCode,
      headers,
      body,
    });
  }

  /**
   * Cache of compiled regexes keyed by operation shape ID.
   */
  protected pathRegexCache = new Map<string, RegExp>();

  /**
   * Extracts path label values from the request path using the operation's URI template.
   *
   * Converts a URI template like `/beers/{beerId}/reviews/{reviewId}`
   * into a regex like `/beers/(?<beerId>[^/]+)/reviews/(?<reviewId>[^/]+)`
   * and extracts named groups from the request path.
   *
   * Compiled regexes are cached by operation shape ID.
   */
  protected extractPathLabels(operationSchema: StaticOperationSchema, requestPath: string): Record<string, string> {
    const [, ns, name, traits] = operationSchema;
    const opTraits = translateTraits(traits ?? {});
    if (!opTraits.http) {
      return {};
    }

    const shapeId = `${ns}#${name}`;
    let regex = this.pathRegexCache.get(shapeId);
    if (!regex) {
      const templatePath = (opTraits.http[1] as string).split("?")[0];
      const regexStr = templatePath.replace(/\{(\w+)\+\}/g, "(?<$1>.+)").replace(/\{(\w+)\}/g, "(?<$1>[^/]+)");
      regex = new RegExp(`^${regexStr}$`);
      this.pathRegexCache.set(shapeId, regex);
    }

    const match = requestPath.split("?")[0].match(regex);

    if (!match?.groups) {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(match.groups)) {
      if (value !== undefined) {
        result[key] = decodeURIComponent(value);
      }
    }
    return result;
  }

  /**
   * Determines whether the request body will be parsed as a protocol document.
   *
   * Returns `true` when:
   * - There is no @httpPayload member (body contains non-bound members serialized as a document), or
   * - @httpPayload targets a structure, union, or document (serialized with the protocol codec).
   *
   * Returns `false` when:
   * - @httpPayload targets a blob or string (raw passthrough, content-type is media-dependent), or
   * - @httpPayload targets a streaming blob (raw stream passthrough).
   */
  protected bodyIsDocument(ns: NormalizedSchema): boolean {
    for (const [, memberSchema] of ns.structIterator()) {
      const traits = memberSchema.getMergedTraits();
      if (traits.httpPayload) {
        if (memberSchema.isBlobSchema()) {
          return false;
        }
        if (memberSchema.isStreaming()) {
          return true;
        }
        if (memberSchema.isStringSchema()) {
          return false;
        }
        break;
      }
    }
    return true;
  }
}
