import { serializerMiddlewareOption } from "@smithy/middleware-serde";
import { EndpointParameters, Pluggable, RelativeMiddlewareOptions, SerializeHandlerOptions } from "@smithy/types";

import { endpointMiddleware } from "./endpointMiddleware";
import { EndpointResolvedConfig } from "./resolveEndpointConfig";
import { EndpointParameterInstructions } from "./types";

/**
 * @internal
 */
export const endpointMiddlewareOptions: SerializeHandlerOptions & RelativeMiddlewareOptions = {
  step: "serialize",
  tags: ["ENDPOINT_PARAMETERS", "ENDPOINT_V2", "ENDPOINT"],
  name: "endpointV2Middleware",
  override: true,
  relation: "before",
  toMiddleware: serializerMiddlewareOption.name!,
};

/**
 * @internal
 */
export const getEndpointPlugin = <T extends EndpointParameters>(
  config: EndpointResolvedConfig<T>,
  instructions: EndpointParameterInstructions
): Pluggable<any, any> => ({
  applyToStack: (clientStack) => {
    clientStack.addRelativeTo(
      endpointMiddleware<T>({
        config,
        instructions,
      }),
      endpointMiddlewareOptions
    );
  },
});
