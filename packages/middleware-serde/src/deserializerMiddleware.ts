import {
  DeserializeHandler,
  DeserializeHandlerArguments,
  DeserializeHandlerOutput,
  DeserializeMiddleware,
  HandlerExecutionContext,
  ResponseDeserializer,
  SerdeFunctions,
} from "@smithy/types";

/**
 * @internal
 *
 * 3rd type parameter is deprecated and unused.
 */
export const deserializerMiddleware = <Input extends object, Output extends object, _ = any>(
  options: SerdeFunctions,
  deserializer: ResponseDeserializer<any, any, SerdeFunctions>
): DeserializeMiddleware<Input, Output> => (
  next: DeserializeHandler<Input, Output>,
  context: HandlerExecutionContext
): DeserializeHandler<Input, Output> => async (
  args: DeserializeHandlerArguments<Input>
): Promise<DeserializeHandlerOutput<Output>> => {
  const { response } = await next(args);
  try {
    const parsed = await deserializer(response, options);
    return {
      response,
      output: parsed as Output,
    };
  } catch (error) {
    // For security reasons, the error response is not completely visible by default.
    Object.defineProperty(error, "$response", {
      value: response,
    });

    if (!("$metadata" in error)) {
      // only apply this to non-ServiceException.
      const hint = `Deserialization error: to see the raw response, inspect the hidden field {error}.$response on this object.`;
      error.message += "\n  " + hint;
    }

    throw error;
  }
};
