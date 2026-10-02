import type { ConfigurableSerdeContext, Logger, SerdeFunctions, StaticOperationSchema } from "@smithy/types";

/**
 * Interface for server-side protocol implementations.
 * This is the server-side counterpart of $ClientProtocol.
 *
 * @public
 */
export interface ServerProtocol<Request, Response> extends ConfigurableSerdeContext {
  /**
   * @returns the Smithy qualified shape id of the protocol trait (e.g. "smithy.protocols#rpcv2Cbor").
   */
  getShapeId(): string;

  /**
   * Determines whether this protocol claims the request.
   *
   * Protocol claiming happens before the traditional request pipeline so the
   * selected protocol can serialize framework errors. Operation routing is a
   * separate step that runs later through {@link route}.
   */
  claim(request: Request, logger?: Logger): boolean;

  /**
   * Resolves the operation from the request after authentication and
   * modifyBeforeDeserialization, matching the traditional SSDK pipeline.
   */
  route(
    request: Request,
    operationSchemas: Readonly<Record<string, StaticOperationSchema>>,
    logger?: Logger
  ): string | undefined;

  /**
   * Deserializes an incoming request into the operation's input type.
   */
  deserializeRequest<Input extends object>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    request: Request
  ): Promise<Input>;

  /**
   * Serializes the operation's output (or error) into a response.
   * Error handling is done via runtime inspection of the output value.
   */
  serializeResponse<Output extends object>(
    operationSchema: StaticOperationSchema,
    context: SerdeFunctions,
    output: Output
  ): Promise<Response>;
}
