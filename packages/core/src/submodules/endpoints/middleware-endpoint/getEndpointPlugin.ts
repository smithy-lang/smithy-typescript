import type {
  EndpointParameterInstructions,
  EndpointParameters,
  Pluggable,
  RelativeMiddlewareOptions,
  SerializeHandlerOptions,
} from "@smithy/types";

import type { GetEndpointFromConfig } from "./adaptors/getEndpointFromInstructions";
import { bindEndpointMiddleware } from "./endpointMiddleware";
import type { EndpointResolvedConfig } from "./resolveEndpointConfig";

/**
 * Inlined from @smithy/core/serde to avoid cross-submodule CJS resolution issue.
 */
const serializerMiddlewareOption = {
  name: "serializerMiddleware",
  step: "serialize",
  tags: ["SERIALIZER"],
  override: true,
} satisfies SerializeHandlerOptions;

/**
 * @internal
 */
export const endpointMiddlewareOptions = {
  step: "serialize",
  tags: ["ENDPOINT_PARAMETERS", "ENDPOINT_V2", "ENDPOINT"],
  name: "endpointV2Middleware",
  override: true,
  relation: "before",
  toMiddleware: serializerMiddlewareOption.name!,
} satisfies SerializeHandlerOptions & RelativeMiddlewareOptions;

/**
 * @internal
 */
export function bindGetEndpointPlugin(getEndpointFromConfig: GetEndpointFromConfig) {
  const endpointMiddleware = bindEndpointMiddleware(getEndpointFromConfig);

  return <T extends EndpointParameters>(
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
}
