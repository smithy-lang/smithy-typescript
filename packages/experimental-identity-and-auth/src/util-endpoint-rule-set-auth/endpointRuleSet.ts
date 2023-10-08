import { EndpointParameterInstructions, resolveParams } from "@smithy/middleware-endpoint";
import { EndpointParameters, EndpointV2, HandlerExecutionContext, Logger } from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { HttpAuthOption } from "../types/auth/HttpAuthScheme";
import {
  HttpAuthSchemeParameters,
  HttpAuthSchemeParametersProvider,
  HttpAuthSchemeProvider,
} from "../types/auth/HttpAuthSchemeProvider";

/**
 * @internal
 */
export interface EndpointRuleSetHttpAuthSchemeProvider<
  EndpointParametersT extends EndpointParameters,
  HttpAuthSchemeParametersT extends HttpAuthSchemeParameters
> extends HttpAuthSchemeProvider<EndpointParametersT & HttpAuthSchemeParametersT> {}

/**
 * @internal
 */
export interface DefaultEndpointResolver<EndpointParametersT extends EndpointParameters> {
  (params: EndpointParametersT, context?: { logger?: Logger }): EndpointV2;
}

/**
 * @internal
 */
export const createEndpointRuleSetHttpAuthSchemeProvider = <
  EndpointParametersT extends EndpointParameters,
  HttpAuthSchemeParametersT extends HttpAuthSchemeParameters
>(
  defaultEndpointResolver: DefaultEndpointResolver<EndpointParametersT>,
  defaultHttpAuthSchemeResolver: HttpAuthSchemeProvider<HttpAuthSchemeParametersT>
): EndpointRuleSetHttpAuthSchemeProvider<EndpointParametersT, HttpAuthSchemeParametersT> => {
  const endpointRuleSetHttpAuthSchemeProvider: EndpointRuleSetHttpAuthSchemeProvider<
    EndpointParametersT,
    HttpAuthSchemeParametersT
  > = (authParameters) => {
    const endpoint: EndpointV2 = defaultEndpointResolver(authParameters);
    const authSchemes = endpoint.properties?.authSchemes;
    if (!authSchemes) {
      return defaultHttpAuthSchemeResolver(authParameters);
    }
    const options: HttpAuthOption[] = [];
    for (const scheme of authSchemes) {
      const { name: resolvedName, properties = {}, ...rest } = scheme;
      const name = resolvedName.toLowerCase();
      if (resolvedName !== name) {
        console.warn(`HttpAuthScheme has been normalized with lowercasing: \`${resolvedName}\` to \`${name}\``);
      }
      let schemeId;
      if (name === "sigv4") {
        schemeId = "aws.auth#sigv4";
      } else if (name === "sigv4a") {
        schemeId = "aws.auth#sigv4a";
      } else {
        throw new Error(`Unknown HttpAuthScheme found in \`@smithy.rules#endpointRuleSet\`: \`${name}\``);
      }
      options.push({
        schemeId,
        signingProperties: {
          ...rest,
          ...properties,
        },
      });
    }
    return options;
  };

  return endpointRuleSetHttpAuthSchemeProvider;
};

/**
 * @internal
 */
export interface EndpointRuleSetSmithyContext {
  endpointRuleSet?: {
    getEndpointParameterInstructions?: () => EndpointParameterInstructions;
  };
}

/**
 * @internal
 */
export interface EndpointRuleSetHttpAuthSchemeParametersProvider<
  TConfig extends object,
  TContext extends HandlerExecutionContext,
  TParameters extends HttpAuthSchemeParameters & EndpointParameters,
  TInput extends object
> extends HttpAuthSchemeParametersProvider<TConfig, TContext, TParameters, TInput> {}

/**
 * @internal
 */
export const createEndpointRuleSetHttpAuthSchemeParametersProvider = <
  TConfig extends object,
  TContext extends HandlerExecutionContext,
  THttpAuthSchemeParameters extends HttpAuthSchemeParameters,
  TEndpointParameters extends EndpointParameters,
  TParameters extends THttpAuthSchemeParameters & TEndpointParameters,
  TInput extends object
>(
  defaultHttpAuthSchemeParametersProvider: HttpAuthSchemeParametersProvider<
    TConfig,
    TContext,
    THttpAuthSchemeParameters,
    TInput
  >
): EndpointRuleSetHttpAuthSchemeParametersProvider<
  TConfig,
  TContext,
  THttpAuthSchemeParameters & TEndpointParameters,
  TInput
> => async (config: TConfig, context: TContext, input: TInput): Promise<TParameters> => {
  if (!input) {
    throw new Error(`Could not find \`input\` for \`defaultEndpointRuleSetHttpAuthSchemeParametersProvider\``);
  }
  const defaultParameters = await defaultHttpAuthSchemeParametersProvider(config, context, input);
  const instructionsFn = (getSmithyContext(context) as EndpointRuleSetSmithyContext)?.endpointRuleSet
    ?.getEndpointParameterInstructions;
  if (!instructionsFn) {
    throw new Error(`getEndpointParameterInstructions() is not defined on \`${context.commandName!}\``);
  }
  const endpointParameters = await resolveParams(
    input as Record<string, unknown>,
    { getEndpointParameterInstructions: instructionsFn! },
    config as Record<string, unknown>
  );
  return Object.assign(defaultParameters, endpointParameters) as TParameters;
};
