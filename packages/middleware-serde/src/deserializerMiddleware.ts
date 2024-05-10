import {
  DeserializeHandler,
  DeserializeHandlerArguments,
  DeserializeHandlerOutput,
  DeserializeMiddleware,
  ResponseDeserializer,
  SerdeContext,
  SerdeFunctions,
} from "@smithy/types";

/**
 * @internal
 */
export const deserializerMiddleware =
  <Input extends object = any, Output extends object = any, CommandSerdeContext extends SerdeContext = any>(
    options: SerdeFunctions,
    deserializer: ResponseDeserializer<any, any, CommandSerdeContext>
  ): DeserializeMiddleware<Input, Output> =>
  (next: DeserializeHandler<Input, Output>): DeserializeHandler<Input, Output> =>
  async (args: DeserializeHandlerArguments<Input>): Promise<DeserializeHandlerOutput<Output>> => {
    const { response } = await next(args);
    try {
      /**
       * [options] is upgraded from SerdeFunctions to CommandSerdeContext,
       * since the generated deserializer expects CommandSerdeContext.
       *
       * This is okay because options is from the same client's resolved config,
       * and the deserializer doesn't need the `endpoint` field.
       */
      const parsed = await deserializer(response, options as CommandSerdeContext);
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

        if (typeof error.$responseBodyText !== "undefined") {
          // if $responseBodyText was collected by the error parser, assign it to
          // replace the response body, because it was consumed and is now empty.
          if (error.$response) {
            error.$response.body = error.$responseBodyText;
          }
        }
      }

      throw error;
    }
  };
