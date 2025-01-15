import {
  DeserializeHandler,
  DeserializeHandlerArguments,
  DeserializeHandlerOptions,
  Endpoint,
  EndpointBearer,
  HandlerExecutionContext,
  MetadataBearer,
  MiddlewareStack,
  OperationSchema as IOperationSchema,
  Pluggable,
  Protocol,
  Provider,
  SerdeContext,
  SerdeFunctions,
  SerializeHandler,
  SerializeHandlerArguments,
  SerializeHandlerOptions,
  UrlParser,
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

/**
 * @internal
 */
type PreviouslyResolved = Omit<
  SerdeContext & {
    urlParser: UrlParser;
    protocol: Protocol<any, any>;
  },
  "endpoint"
>;

/**
 * @internal
 */
export function getSchemaSerdePlugin<InputType extends object = any, OutputType extends MetadataBearer = any>(
  config: PreviouslyResolved
): Pluggable<InputType, OutputType> {
  return {
    applyToStack: (commandStack: MiddlewareStack<InputType, OutputType>) => {
      commandStack.add(schemaSerializationMiddleware(config), serializerMiddlewareOption);
      commandStack.add(schemaDeserializationMiddleware(config), deserializerMiddlewareOption);
      // `config` is fully resolved at the point of applying plugins.
      // As such, config qualifies as SerdeContext.
      config.protocol.setSerdeContext(config as SerdeFunctions);
    },
  };
}

/**
 * @internal
 */
export const schemaSerializationMiddleware =
  (config: PreviouslyResolved) =>
  (next: SerializeHandler<any, any>, context: HandlerExecutionContext) =>
  async (args: SerializeHandlerArguments<any>) => {
    const { operationSchema } = getSmithyContext(context) as {
      operationSchema: IOperationSchema;
    };

    const endpoint: Provider<Endpoint> =
      context.endpointV2?.url && config.urlParser
        ? async () => config.urlParser!(context.endpointV2!.url as URL)
        : (config as unknown as EndpointBearer).endpoint!;

    const request = await config.protocol.serializeRequest(operationSchema, args.input, {
      ...config,
      ...context,
      endpoint,
    });
    return next({
      ...args,
      request,
    });
  };

/**
 * @internal
 */
export const schemaDeserializationMiddleware =
  <O>(config: PreviouslyResolved) =>
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
      }

      throw error;
    }
  };
