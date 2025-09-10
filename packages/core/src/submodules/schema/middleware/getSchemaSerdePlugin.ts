import type {
  DeserializeHandlerOptions,
  MetadataBearer,
  MiddlewareStack,
  Pluggable,
  SerdeFunctions,
  SerializeHandlerOptions,
} from "@smithy/types";

import type { PreviouslyResolved } from "./schema-middleware-types";
import { schemaDeserializationMiddleware } from "./schemaDeserializationMiddleware";
import { schemaSerializationMiddleware } from "./schemaSerializationMiddleware";

/**
 * @internal
 */
export const deserializerMiddlewareOption: DeserializeHandlerOptions = {
  name: "deserializerMiddleware",
  step: "deserialize",
  tags: ["DESERIALIZER"],
  override: true,
};

/**
 * @internal
 */
export const serializerMiddlewareOption: SerializeHandlerOptions = {
  name: "serializerMiddleware",
  step: "serialize",
  tags: ["SERIALIZER"],
  override: true,
};

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
