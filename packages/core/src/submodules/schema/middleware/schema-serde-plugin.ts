import {
  DeserializeHandler,
  DeserializeHandlerArguments,
  DeserializeHandlerOptions,
  HandlerExecutionContext,
  MetadataBearer,
  MiddlewareStack,
  OperationSchema as IOperationSchema,
  Pluggable,
  Protocol,
  SerdeFunctions,
  SerializeHandler,
  SerializeHandlerArguments,
  SerializeHandlerOptions,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

export const deserializerMiddlewareOption: DeserializeHandlerOptions = {
  name: "deserializerMiddleware",
  step: "deserialize",
  tags: ["DESERIALIZER"],
  override: true,
};

export const serializerMiddlewareOption: SerializeHandlerOptions = {
  name: "serializerMiddleware",
  step: "serialize",
  tags: ["SERIALIZER"],
  override: true,
};

export type ProtocolAwareConfig = {
  protocol: Protocol<any, any>;
};

/**
 * @internal
 */
export function getSchemaSerdePlugin<InputType extends object = any, OutputType extends MetadataBearer = any>(
  config: ProtocolAwareConfig & SerdeFunctions
): Pluggable<InputType, OutputType> {
  return {
    applyToStack: (commandStack: MiddlewareStack<InputType, OutputType>) => {
      commandStack.add(schemaSerializationMiddleware(config), serializerMiddlewareOption);
      commandStack.add(schemaDeserializationMiddleware(config), deserializerMiddlewareOption);
    },
  };
}

/**
 * @internal
 */
export const schemaSerializationMiddleware =
  (config: ProtocolAwareConfig & SerdeFunctions) =>
  (next: SerializeHandler<any, any>, context: HandlerExecutionContext) =>
  async (args: SerializeHandlerArguments<any>) => {
    const { operationSchema } = getSmithyContext(context) as {
      operationSchema: IOperationSchema;
    };
    const request = await config.protocol.serializeRequest(operationSchema, args.input, context);
    return next({
      ...args,
      request,
    });
  };

/**
 * @internal
 */
export const schemaDeserializationMiddleware =
  <O>(config: ProtocolAwareConfig & SerdeFunctions) =>
  (next: DeserializeHandler<any, any>, context: HandlerExecutionContext) =>
  async (args: DeserializeHandlerArguments<any>) => {
    const { response } = await next(args);
    const { operationSchema } = getSmithyContext(context) as {
      operationSchema: IOperationSchema;
    };
    try {
      const parsed = await config.protocol.deserializeResponse(
        operationSchema,
        {
          streamCollector: config.streamCollector,
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
      }

      throw error;
    }
  };
