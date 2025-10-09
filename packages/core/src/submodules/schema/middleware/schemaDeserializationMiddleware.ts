import { HttpResponse } from "@smithy/protocol-http";
import type {
  DeserializeHandler,
  DeserializeHandlerArguments,
  HandlerExecutionContext,
  MetadataBearer,
  OperationSchema,
  StaticOperationSchema,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { hydrate, isStaticSchema } from "../schemas/NormalizedSchema";
import type { PreviouslyResolved } from "./schema-middleware-types";

/**
 * @internal
 */
export const schemaDeserializationMiddleware =
  <O>(config: PreviouslyResolved) =>
  (next: DeserializeHandler<any, any>, context: HandlerExecutionContext) =>
  async (args: DeserializeHandlerArguments<any>) => {
    const { response } = await next(args);
    let { operationSchema } = getSmithyContext(context) as {
      operationSchema: OperationSchema | StaticOperationSchema;
    };
    if (isStaticSchema(operationSchema)) {
      operationSchema = hydrate(operationSchema);
    }

    try {
      const parsed = await config.protocol.deserializeResponse(
        operationSchema,
        {
          ...config,
          ...context,
        },
        response
      );
      return {
        response,
        output: parsed as O,
      };
    } catch (error) {
      // For security reasons, the error response is not completely visible by default.
      Object.defineProperty(error, "$response", {
        value: response,
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
