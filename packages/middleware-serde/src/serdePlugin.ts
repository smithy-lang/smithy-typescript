import type {
  DeserializeHandlerOptions,
  Endpoint,
  MetadataBearer,
  MiddlewareStack,
  Pluggable,
  Provider,
  RequestSerializer,
  ResponseDeserializer,
  SerdeContext,
  SerdeFunctions,
  SerializeHandlerOptions,
  UrlParser,
} from "@smithy/types";

import { deserializerMiddleware } from "./deserializerMiddleware";
import { serializerMiddleware } from "./serializerMiddleware";

/**
 * @deprecated will be replaced by schemaSerdePlugin from core/schema.
 */
export const deserializerMiddlewareOption: DeserializeHandlerOptions = {
  name: "deserializerMiddleware",
  step: "deserialize",
  tags: ["DESERIALIZER"],
  override: true,
};

/**
 * @deprecated will be replaced by schemaSerdePlugin from core/schema.
 */
export const serializerMiddlewareOption: SerializeHandlerOptions = {
  name: "serializerMiddleware",
  step: "serialize",
  tags: ["SERIALIZER"],
  override: true,
};

/**
 * Modifies the EndpointBearer to make it compatible with Endpoints 2.0 change.
 *
 * @internal
 * @deprecated
 */
export type V1OrV2Endpoint = {
  // for v2
  urlParser?: UrlParser;

  // for v1
  endpoint?: Provider<Endpoint>;
};

/**
 * @internal
 * @deprecated will be replaced by schemaSerdePlugin from core/schema.
 */
export function getSerdePlugin<
  InputType extends object = any,
  CommandSerdeContext extends SerdeContext = any,
  OutputType extends MetadataBearer = any,
>(
  config: SerdeFunctions,
  serializer: RequestSerializer<any, CommandSerdeContext>,
  deserializer: ResponseDeserializer<OutputType, any, CommandSerdeContext>
): Pluggable<InputType, OutputType> {
  return {
    applyToStack: (commandStack: MiddlewareStack<InputType, OutputType>) => {
      commandStack.add(deserializerMiddleware(config, deserializer), deserializerMiddlewareOption);
      commandStack.add(serializerMiddleware(config, serializer), serializerMiddlewareOption);
    },
  };
}
