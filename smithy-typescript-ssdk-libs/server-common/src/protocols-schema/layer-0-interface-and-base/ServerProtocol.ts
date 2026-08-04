import type {
  ConfigurableSerdeContext,
  $OperationSchema,
  SerdeFunctions,
  HandlerExecutionContext,
} from "@smithy/types";

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
   * Deserializes an incoming request into the operation's input type.
   */
  deserializeRequest<Input extends object>(
    operationSchema: $OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    request: Request
  ): Promise<Input>;

  /**
   * Serializes the operation's output (or error) into a response.
   * Error handling is done via runtime inspection of the output value.
   */
  serializeResponse<Output extends object>(
    operationSchema: $OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    output: Output
  ): Promise<Response>;
}
