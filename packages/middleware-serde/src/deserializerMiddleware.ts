import { HttpResponse } from "@smithy/protocol-http";
import type {
  DeserializeHandler,
  DeserializeHandlerArguments,
  DeserializeHandlerOutput,
  DeserializeMiddleware,
  HandlerExecutionContext,
  MetadataBearer,
  ResponseDeserializer,
  SerdeContext,
  SerdeFunctions,
} from "@smithy/types";

/**
 * @internal
 * @deprecated will be replaced by schemaSerdePlugin from core/schema.
 */
export const deserializerMiddleware =
  <Input extends object = any, Output extends object = any, CommandSerdeContext extends SerdeContext = any>(
    options: SerdeFunctions,
    deserializer: ResponseDeserializer<any, any, CommandSerdeContext>
  ): DeserializeMiddleware<Input, Output> =>
  (next: DeserializeHandler<Input, Output>, context: HandlerExecutionContext): DeserializeHandler<Input, Output> =>
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
        // we need to define these properties explicitly because
        // the service exception class may have set the value to undefined, but populated the key.
        enumerable: false,
        writable: false,
        configurable: false,
      });

      if (!("$metadata" in error)) {
        // only apply this to non-ServiceException.
        const hint = `Deserialization error: to see the raw response, inspect the hidden field {error}.$response on this object.`;
        try {
          error.message += "\n  " + hint;
        } catch (e) {
          // Error with an unwritable message (strict mode getter with no setter).
          if (!context.logger || context.logger?.constructor?.name === "NoOpLogger") {
            console.warn(hint);
          } else {
            context.logger?.warn?.(hint);
          }
        }

        if (typeof error.$responseBodyText !== "undefined") {
          // if $responseBodyText was collected by the error parser, assign it to
          // replace the response body, because it was consumed and is now empty.
          if (error.$response) {
            error.$response.body = error.$responseBodyText;
          }
        }

        try {
          // if the deserializer failed, then $metadata may still be set
          // by taking information from the response.
          if (HttpResponse.isInstance(response)) {
            const { headers = {} } = response;
            const headerEntries = Object.entries(headers);
            (error as MetadataBearer).$metadata = {
              httpStatusCode: response.statusCode,
              requestId: findHeader(/^x-[\w-]+-request-?id$/, headerEntries),
              extendedRequestId: findHeader(/^x-[\w-]+-id-2$/, headerEntries),
              cfId: findHeader(/^x-[\w-]+-cf-id$/, headerEntries),
            };
          }
        } catch (e) {
          // ignored, error object was not writable.
        }
      }

      throw error;
    }
  };

/**
 * @internal
 * @returns header value where key matches regex.
 */
const findHeader = (pattern: RegExp, headers: [string, string][]): string | undefined => {
  return (headers.find(([k]) => {
    return k.match(pattern);
  }) || [void 0, void 1])[1];
};
