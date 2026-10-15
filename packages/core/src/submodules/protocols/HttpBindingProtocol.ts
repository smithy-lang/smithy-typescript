import { NormalizedSchema, type TypeRegistry } from "@smithy/core/schema";
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
} from "@smithy/types";

import { getHttpOperationBindingExtension, getHttpStructBindingExtension } from "./HttpBindingSchemaExtension";
import { HttpProtocol } from "./HttpProtocol";
import { collectBody } from "./collect-stream-body";
import { HttpBindingDeserializer } from "./serde/HttpBindingDeserializer";
import { HttpBindingSerializer } from "./serde/HttpBindingSerializer";

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
    const bindings = getHttpStructBindingExtension(ns).request();
    const operationBinding = getHttpOperationBindingExtension(operationSchema);
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
      if (operationBinding.method) {
        request.method = operationBinding.method;
        if (request.path == "/") {
          request.path = operationBinding.path!;
        } else {
          request.path += operationBinding.path!;
        }
        for (const [key, value] of operationBinding.query) {
          query[key] = value;
        }
      }
    }

    request.headers = headers;
    request.query = query;
    const eventStreamInput = new HttpBindingSerializer(this.serializer, bindings, operationBinding).serialize(
      input,
      request,
      ns
    );
    if (eventStreamInput) {
      request.body = await this.serializeEventStream(eventStreamInput);
    }

    return request;
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

    const bindingDeserializer = new HttpBindingDeserializer(deserializer, getHttpStructBindingExtension(ns).response());
    const eventStreamOutput = await bindingDeserializer.deserialize(ns, context, response, dataObject, true);
    if (eventStreamOutput) {
      dataObject[eventStreamOutput.memberName] = await this.deserializeEventStream({
        response,
        responseSchema: eventStreamOutput.responseSchema,
      });
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

    const ns = NormalizedSchema.of(schema);
    const bindings = getHttpStructBindingExtension(ns).response();
    const bindingDeserializer = new HttpBindingDeserializer(this.deserializer, bindings);
    const eventStreamOutput = await bindingDeserializer.deserialize(ns, context, response, dataObject, false);
    if (eventStreamOutput) {
      dataObject[eventStreamOutput.memberName] = await this.deserializeEventStream({
        response,
        responseSchema: eventStreamOutput.responseSchema,
      });
    }

    return bindings.bodyMemberNames;
  }
}
