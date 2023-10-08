import { serializerMiddlewareOption } from "@smithy/middleware-serde";
import { HandlerExecutionContext, Pluggable, RelativeMiddlewareOptions, SerializeHandlerOptions } from "@smithy/types";

import { HttpAuthSchemeParameters } from "../types/auth/HttpAuthSchemeProvider";
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
  toMiddleware: serializerMiddlewareOption.name!,
};

/**
 * @internal
 */
export const getHttpAuthSchemePlugin = <
  TConfig extends object,
  TContext extends HandlerExecutionContext,
  TParameters extends HttpAuthSchemeParameters,
  TInput extends object
>(
  config: TConfig & PreviouslyResolved<TConfig, TContext, TParameters, TInput>
): Pluggable<any, any> => ({
  applyToStack: (clientStack) => {
    clientStack.addRelativeTo(httpAuthSchemeMiddleware(config), httpAuthSchemeMiddlewareOptions);
  },
});
