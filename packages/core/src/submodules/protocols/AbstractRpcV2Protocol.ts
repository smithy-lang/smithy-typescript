import { deref } from "@smithy/core/schema";
import { getSmithyContext } from "@smithy/core/transport";
import type {
  EndpointBearer,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  OperationSchema,
  SerdeFunctions,
} from "@smithy/types";
import type { TypeRegistry } from "@smithy/core/schema";

import { RpcProtocol } from "./RpcProtocol";

/**
 * Shared abstract base for the Smithy RPC v2 client protocols (JSON and CBOR).
 *
 * Factors out the request-framing flow and response status handling that are
 * identical across both RPC v2 protocols. Concrete protocols supply their
 * codec, error handling, content type, shape id, and the two per-protocol
 * request details via {@link getSmithyProtocolHeaderValue} and
 * {@link applyEmptyBody}.
 *
 * @internal
 */
export abstract class AbstractRpcV2Protocol extends RpcProtocol {
  /**
   * @override
   */
  declare protected compositeErrorRegistry: TypeRegistry;

  public constructor({
    defaultNamespace,
    errorTypeRegistries,
  }: {
    defaultNamespace: string;
    errorTypeRegistries?: TypeRegistry[];
  }) {
    super({ defaultNamespace, errorTypeRegistries });
  }

  public async serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<IHttpRequest> {
    const request = await super.serializeRequest(operationSchema, input, context);
    Object.assign(request.headers, {
      "content-type": this.getDefaultContentType(),
      "smithy-protocol": this.getSmithyProtocolHeaderValue(),
      accept: this.getDefaultContentType(),
    });
    if (deref(operationSchema.input) === "unit") {
      delete request.body;
      delete request.headers["content-type"];
    } else {
      this.applyEmptyBody(request);
    }
    const { service, operation } = getSmithyContext(context) as {
      service: string;
      operation: string;
    };
    const path = `/service/${service}/operation/${operation}`;
    if (request.path.endsWith("/")) {
      request.path += path.slice(1);
    } else {
      request.path += path;
    }
    return request;
  }

  /**
   * @override
   *
   * Per the Smithy RPC v2 specification, the only successful response status
   * code is 200; any other status code MUST be handled as an error.
   */
  protected override isErrorResponse(statusCode: number): boolean {
    return statusCode !== 200;
  }

  /**
   * @returns the value of the `smithy-protocol` header for this protocol,
   * e.g. `rpc-v2-json` or `rpc-v2-cbor`.
   */
  protected abstract getSmithyProtocolHeaderValue(): string;

  /**
   * Applies this protocol's representation of an empty request body when the
   * operation has a non-unit input but produced no serialized body. Called
   * only for non-unit inputs.
   *
   * @param request - the request being serialized, mutated in place.
   */
  protected abstract applyEmptyBody(request: IHttpRequest): void;
}
