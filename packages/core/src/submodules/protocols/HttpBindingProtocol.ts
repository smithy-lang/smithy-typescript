import { NormalizedSchema, SCHEMA } from "@smithy/core/schema";
import { HttpRequest } from "@smithy/protocol-http";
import {
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
    input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<IHttpRequest> {
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

    const _input: any = {
      ...input,
    };

    for (const [memberName, memberNs] of ns.structIterator()) {
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
          // structural/document body
          serializer.write(memberNs, inputMember);
          payload = serializer.flush();
        }
      } else if (memberTraits.httpLabel) {
        serializer.write(memberNs, inputMember);
        const replacement = serializer.flush() as string;
        if (request.path.includes(`{${memberName}+}`)) {
          request.path = request.path.replace(
            `{${memberName}+}`,
            replacement.split("/").map(extendedEncodeURIComponent).join("/")
          );
        } else if (request.path.includes(`{${memberName}}`)) {
          request.path = request.path.replace(`{${memberName}}`, extendedEncodeURIComponent(replacement));
        }
        delete _input[memberName];
      } else if (memberTraits.httpHeader) {
        serializer.write(memberNs, inputMember);
        headers[memberTraits.httpHeader.toLowerCase() as string] = String(serializer.flush());
        delete _input[memberName];
      } else if (typeof memberTraits.httpPrefixHeaders === "string") {
        for (const [key, val] of Object.entries(inputMember)) {
          const amalgam = memberTraits.httpPrefixHeaders + key;
          serializer.write([memberNs.getValueSchema(), { httpHeader: amalgam }], val);
          headers[amalgam.toLowerCase()] = serializer.flush() as string;
        }
        delete _input[memberName];
      } else if (memberTraits.httpQuery || memberTraits.httpQueryParams) {
        this.serializeQuery(memberNs, inputMember, query);
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
    }

    const output: Output = {
      $metadata: this.deserializeMetadata(response),
      ...dataObject,
    };

    return output;
  }
}
