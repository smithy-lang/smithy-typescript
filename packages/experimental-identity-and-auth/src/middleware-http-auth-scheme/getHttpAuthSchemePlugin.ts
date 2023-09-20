import { endpointMiddlewareOptions } from "@smithy/middleware-endpoint";
import { MetadataBearer, Pluggable, RelativeMiddlewareOptions, SerializeHandlerOptions } from "@smithy/types";

import { httpAuthSchemeMiddleware, PreviouslyResolved } from "./httpAuthSchemeMiddleware";

/**
 * @internal
 */
export const httpAuthSchemeMiddlewareOptions: SerializeHandlerOptions & RelativeMiddlewareOptions = {
  step: "serialize",
  tags: ["HTTP_AUTH_SCHEME"],
  name: "httpAuthSchemeMiddleware",
  override: true,
  relation: "before",
  toMiddleware: endpointMiddlewareOptions.name!,
};

/**
 * @internal
 */
export const getHttpAuthSchemePlugin = <
  Input extends Record<string, unknown> = Record<string, unknown>,
  Output extends MetadataBearer = MetadataBearer
>(
  config: PreviouslyResolved
): Pluggable<Input, Output> => ({
  applyToStack: (clientStack) => {
    clientStack.addRelativeTo(httpAuthSchemeMiddleware(config), httpAuthSchemeMiddlewareOptions);
  },
});
