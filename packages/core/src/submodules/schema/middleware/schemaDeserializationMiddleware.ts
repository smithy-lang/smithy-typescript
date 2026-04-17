import { HttpResponse } from "@smithy/protocol-http";
import type {
  DeserializeHandler,
  DeserializeHandlerArguments,
  HandlerExecutionContext,
  MetadataBearer,
  StaticOperationSchema,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { operation } from "../schemas/operation";
import type { PreviouslyResolved } from "./schema-middleware-types";

/**
 * @internal
 */
export const schemaDeserializationMiddleware =
  <O>(config: PreviouslyResolved) =>
  (next: DeserializeHandler<any, any>, context: HandlerExecutionContext) =>
  async (args: DeserializeHandlerArguments<any>) => {
    const { response } = await next(args);
    const { operationSchema } = getSmithyContext(context) as {
      operationSchema: StaticOperationSchema;
    };
    const [, ns, n, t, i, o] = operationSchema ?? [];

    try {
      const parsed = await config.protocol.deserializeResponse(
        operation(ns, n, t, i, o),
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

            let requestId: string | undefined;
            let extendedRequestId: string | undefined;
            let cfId: string | undefined;

            for (const k in headers) {
              if (/^x-[\w-]+-request-?id$/.test(k)) requestId = headers[k];
              else if (/^x-[\w-]+-id-2$/.test(k)) extendedRequestId = headers[k];
              else if (/^x-[\w-]+-cf-id$/.test(k)) cfId = headers[k];
            }

            (error as MetadataBearer).$metadata = {
              httpStatusCode: response.statusCode,
              requestId,
              extendedRequestId,
              cfId,
            };
          }
        } catch (e) {
          // ignored, error object was not writable.
        }
      }

      throw error;
    }
  };
