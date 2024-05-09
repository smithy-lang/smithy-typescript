import {
  HandlerExecutionContext,
  HttpAuthScheme,
  HttpAuthSchemeId,
  HttpAuthSchemeParameters,
  HttpAuthSchemeParametersProvider,
  HttpAuthSchemeProvider,
  IdentityProviderConfig,
  SelectedHttpAuthScheme,
  SerializeHandler,
  SerializeHandlerArguments,
  SerializeHandlerOutput,
  SerializeMiddleware,
  SMITHY_CONTEXT_KEY,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

/**
 * @internal
 */
export interface PreviouslyResolved<TParameters extends HttpAuthSchemeParameters> {
  httpAuthSchemes: HttpAuthScheme[];
  httpAuthSchemeProvider: HttpAuthSchemeProvider<TParameters>;
}

/**
 * @internal
 */
interface HttpAuthSchemeMiddlewareOptions<
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
interface HttpAuthSchemeMiddlewareSmithyContext extends Record<string, unknown> {
  selectedHttpAuthScheme?: SelectedHttpAuthScheme;
}

/**
 * @internal
 */
interface HttpAuthSchemeMiddlewareHandlerExecutionContext extends HandlerExecutionContext {
  [SMITHY_CONTEXT_KEY]?: HttpAuthSchemeMiddlewareSmithyContext;
}

/**
 * @internal
 * Later HttpAuthSchemes with the same HttpAuthSchemeId will overwrite previous ones.
 */
function convertHttpAuthSchemesToMap(httpAuthSchemes: HttpAuthScheme[]): Map<HttpAuthSchemeId, HttpAuthScheme> {
  const map = new Map();
  for (const scheme of httpAuthSchemes) {
    map.set(scheme.schemeId, scheme);
  }
  return map;
}

/**
 * @internal
 */
export const httpAuthSchemeMiddleware =
  <
    TInput extends object,
    Output extends object,
    TConfig extends object,
    TContext extends HttpAuthSchemeMiddlewareHandlerExecutionContext,
    TParameters extends HttpAuthSchemeParameters,
  >(
    config: TConfig & PreviouslyResolved<TParameters>,
    mwOptions: HttpAuthSchemeMiddlewareOptions<TConfig, TContext, TParameters, TInput>
  ): SerializeMiddleware<TInput, Output> =>
  (
    next: SerializeHandler<TInput, Output>,
    context: HttpAuthSchemeMiddlewareHandlerExecutionContext
  ): SerializeHandler<TInput, Output> =>
  async (args: SerializeHandlerArguments<TInput>): Promise<SerializeHandlerOutput<Output>> => {
    const options = config.httpAuthSchemeProvider(
      await mwOptions.httpAuthSchemeParametersProvider(config, context as TContext, args.input)
    );
    const authSchemes = convertHttpAuthSchemesToMap(config.httpAuthSchemes);
    const smithyContext: HttpAuthSchemeMiddlewareSmithyContext = getSmithyContext(context);
    const failureReasons = [];
    for (const option of options) {
      const scheme = authSchemes.get(option.schemeId);
      if (!scheme) {
        failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` was not enabled for this service.`);
        continue;
      }
      const identityProvider = scheme.identityProvider(await mwOptions.identityProviderConfigProvider(config));
      if (!identityProvider) {
        failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` did not have an IdentityProvider configured.`);
        continue;
      }
      const { identityProperties = {}, signingProperties = {} } = option.propertiesExtractor?.(config, context) || {};
      option.identityProperties = Object.assign(option.identityProperties || {}, identityProperties);
      option.signingProperties = Object.assign(option.signingProperties || {}, signingProperties);
      smithyContext.selectedHttpAuthScheme = {
        httpAuthOption: option,
        identity: await identityProvider(option.identityProperties),
        signer: scheme.signer,
      };
      break;
    }
    if (!smithyContext.selectedHttpAuthScheme) {
      throw new Error(failureReasons.join("\n"));
    }
    return next(args);
  };
