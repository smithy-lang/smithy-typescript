import type {
  HandlerExecutionContext,
  HttpAuthSchemeParameters,
  HttpAuthSchemeParametersProvider,
  IdentityProviderConfig,
  Pluggable,
  RelativeMiddlewareOptions,
  SerializeHandlerOptions,
} from "@smithy/types";

import type { PreviouslyResolved } from "./httpAuthSchemeMiddleware";
import { httpAuthSchemeMiddleware } from "./httpAuthSchemeMiddleware";

/**
 * @internal
 */
export const httpAuthSchemeEndpointRuleSetMiddlewareOptions: SerializeHandlerOptions & RelativeMiddlewareOptions = {
  step: "serialize",
  tags: ["HTTP_AUTH_SCHEME"],
  name: "httpAuthSchemeMiddleware",
  override: true,
  relation: "before",
  toMiddleware: "endpointV2Middleware",
};

/**
 * @internal
 */
interface HttpAuthSchemeEndpointRuleSetPluginOptions<
  TConfig extends object,
  TContext extends HandlerExecutionContext,
  TParameters extends HttpAuthSchemeParameters,
  TInput extends object,
> {
  httpAuthSchemeParametersProvider: HttpAuthSchemeParametersProvider<TConfig, TContext, TParameters, TInput>;
  identityProviderConfigProvider: (config: TConfig) => Promise<IdentityProviderConfig>;
}

/**
 * @internal
 */
export const getHttpAuthSchemeEndpointRuleSetPlugin = <
  TConfig extends object,
  TContext extends HandlerExecutionContext,
  TParameters extends HttpAuthSchemeParameters,
  TInput extends object,
>(
  config: TConfig & PreviouslyResolved<TParameters>,
  {
    httpAuthSchemeParametersProvider,
    identityProviderConfigProvider,
  }: HttpAuthSchemeEndpointRuleSetPluginOptions<TConfig, TContext, TParameters, TInput>
): Pluggable<any, any> => ({
  applyToStack: (clientStack) => {
    clientStack.addRelativeTo(
      httpAuthSchemeMiddleware(config, {
        httpAuthSchemeParametersProvider,
        identityProviderConfigProvider,
      }),
      httpAuthSchemeEndpointRuleSetMiddlewareOptions
    );
  },
});
