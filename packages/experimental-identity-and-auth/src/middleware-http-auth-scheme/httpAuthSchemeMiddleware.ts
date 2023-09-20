import {
  HandlerExecutionContext,
  MetadataBearer,
  SerializeHandler,
  SerializeHandlerArguments,
  SerializeHandlerOutput,
  SerializeMiddleware,
  SMITHY_CONTEXT_KEY,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { HttpAuthScheme, HttpAuthSchemeId, SelectedHttpAuthScheme } from "../HttpAuthScheme";
import { HttpAuthSchemeParametersProvider, HttpAuthSchemeProvider } from "../HttpAuthSchemeProvider";
import { IdentityProviderConfig } from "../IdentityProviderConfig";

/**
 * @internal
 */
export interface PreviouslyResolved {
  httpAuthSchemes: HttpAuthScheme[];
  httpAuthSchemeProvider: HttpAuthSchemeProvider;
  httpAuthSchemeParametersProvider: HttpAuthSchemeParametersProvider;
  identityProviderConfig: IdentityProviderConfig;
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
export const httpAuthSchemeMiddleware = <
  Input extends Record<string, unknown> = Record<string, unknown>,
  Output extends MetadataBearer = MetadataBearer
>(
  config: PreviouslyResolved
): SerializeMiddleware<Input, Output> => (
  next: SerializeHandler<Input, Output>,
  context: HttpAuthSchemeMiddlewareHandlerExecutionContext
): SerializeHandler<Input, Output> => async (
  args: SerializeHandlerArguments<Input>
): Promise<SerializeHandlerOutput<Output>> => {
  const options = config.httpAuthSchemeProvider(
    await config.httpAuthSchemeParametersProvider(config, context, args.input)
  );
  const authSchemes = convertHttpAuthSchemesToMap(config.httpAuthSchemes);
  const smithyContext: HttpAuthSchemeMiddlewareSmithyContext = getSmithyContext(context);
  const failureReasons = [];
  for (const option of options) {
    const scheme = authSchemes.get(option.schemeId);
    if (!scheme) {
      failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` was not enable for this service.`);
      continue;
    }
    const identityProvider = scheme.identityProvider(config.identityProviderConfig);
    if (!identityProvider) {
      failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` did not have an IdentityProvider configured.`);
      continue;
    }
    const identity = await identityProvider(option.identityProperties || {});
    smithyContext.selectedHttpAuthScheme = {
      httpAuthOption: option,
      identity,
      signer: scheme.signer,
    };
    break;
  }
  if (!smithyContext.selectedHttpAuthScheme) {
    throw new Error(failureReasons.join("\n"));
  }
  return next(args);
};
