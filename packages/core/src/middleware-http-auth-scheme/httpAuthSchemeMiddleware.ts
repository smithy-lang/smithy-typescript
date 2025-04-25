import {
  HandlerExecutionContext,
  HttpAuthOption,
  HttpAuthScheme,
  HttpAuthSchemeId,
  HttpAuthSchemeParameters,
  HttpAuthSchemeParametersProvider,
  HttpAuthSchemeProvider,
  IdentityProviderConfig,
  Provider,
  SelectedHttpAuthScheme,
  SerializeHandler,
  SerializeHandlerArguments,
  SerializeHandlerOutput,
  SerializeMiddleware,
  SMITHY_CONTEXT_KEY,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { resolveAuthSchemes } from "./resolveAuthSchemes";

/**
 * @internal
 */
export interface PreviouslyResolved<TParameters extends HttpAuthSchemeParameters> {
  authSchemePreference: Provider<string[]>;
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
 */
function convertHttpAuthOptionsToMap(httpAuthOptions: HttpAuthOption[]): Map<HttpAuthSchemeId, HttpAuthOption> {
  const map = new Map();
  for (const authOption of httpAuthOptions) {
    map.set(authOption.schemeId, authOption);
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
    const optionsMap = convertHttpAuthOptionsToMap(options);

    const authSchemePreference = config.authSchemePreference ? await config.authSchemePreference() : [];
    const resolvedAuthSchemes = resolveAuthSchemes(config.httpAuthSchemes, authSchemePreference);
    config.httpAuthSchemes = resolvedAuthSchemes;

    const smithyContext: HttpAuthSchemeMiddlewareSmithyContext = getSmithyContext(context);
    const failureReasons = [];

    for (const scheme of resolvedAuthSchemes) {
      const option = optionsMap.get(scheme.schemeId) as HttpAuthOption;
      const identityProvider = scheme.identityProvider(await mwOptions.identityProviderConfigProvider(config));
      if (!identityProvider) {
        failureReasons.push(`HttpAuthScheme \`${scheme.schemeId}\` did not have an IdentityProvider configured.`);
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
