import { retryMiddlewareOptions } from "@smithy/middleware-retry";
import type { FinalizeRequestHandlerOptions, Pluggable, RelativeMiddlewareOptions } from "@smithy/types";

import { httpSigningMiddleware } from "./httpSigningMiddleware";

/**
 * @internal
 */
export const httpSigningMiddlewareOptions: FinalizeRequestHandlerOptions & RelativeMiddlewareOptions = {
  step: "finalizeRequest",
  tags: ["HTTP_SIGNING"],
  name: "httpSigningMiddleware",
  aliases: ["apiKeyMiddleware", "tokenMiddleware", "awsAuthMiddleware"],
  override: true,
  relation: "after",
  toMiddleware: retryMiddlewareOptions.name!,
};

/**
 * @internal
 */
export const getHttpSigningPlugin = <Input extends object, Output extends object>(
  config: object
): Pluggable<Input, Output> => ({
  applyToStack: (clientStack) => {
    clientStack.addRelativeTo(httpSigningMiddleware(config), httpSigningMiddlewareOptions);
  },
});
