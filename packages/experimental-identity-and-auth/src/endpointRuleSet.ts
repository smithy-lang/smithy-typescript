import { EndpointParameterInstructions, resolveParams } from "@smithy/middleware-endpoint";
import { EndpointParameters, EndpointV2, HandlerExecutionContext, Logger } from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { HttpAuthOption } from "./HttpAuthScheme";
import {
  HttpAuthSchemeParameters,
  HttpAuthSchemeParametersProvider,
  HttpAuthSchemeProvider,
} from "./HttpAuthSchemeProvider";

/**
 * @internal
 */
export interface EndpointRuleSetHttpAuthSchemeProvider<
  EndpointParametersT extends EndpointParameters = EndpointParameters,
  HttpAuthSchemeParametersT extends HttpAuthSchemeParameters = HttpAuthSchemeParameters
> extends HttpAuthSchemeProvider<EndpointParametersT & HttpAuthSchemeParametersT> {}

/**
 * @internal
 */
export interface DefaultEndpointResolver<EndpointParametersT extends EndpointParameters = EndpointParameters> {
  (params: EndpointParametersT, context?: { logger?: Logger }): EndpointV2;
}

/**
 * @internal
 */
export interface CreateEndpointRuleSetHttpAuthSchemeProvider<
  EndpointParametersT extends EndpointParameters = EndpointParameters,
  HttpAuthSchemeParametersT extends HttpAuthSchemeParameters = HttpAuthSchemeParameters
> {
  (
    defaultEndpointResolver: DefaultEndpointResolver<EndpointParametersT>,
    defaultHttpAuthSchemeResolver: HttpAuthSchemeProvider<HttpAuthSchemeParametersT>
  ): EndpointRuleSetHttpAuthSchemeProvider;
}

/**
 * @internal
 */
export const createEndpointRuleSetHttpAuthSchemeProvider: CreateEndpointRuleSetHttpAuthSchemeProvider = <
  EndpointParametersT extends EndpointParameters = EndpointParameters,
  HttpAuthSchemeParametersT extends HttpAuthSchemeParameters = HttpAuthSchemeParameters
>(
  defaultEndpointResolver: DefaultEndpointResolver<EndpointParametersT>,
  defaultHttpAuthSchemeResolver: HttpAuthSchemeProvider<HttpAuthSchemeParametersT>
) => {
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
export interface CreateEndpointRuleSetHttpAuthSchemeParametersProvider<
  HttpAuthSchemeParametersProviderT extends HttpAuthSchemeParametersProvider = HttpAuthSchemeParametersProvider
> {
  (defaultHttpAuthSchemeResolver: HttpAuthSchemeParametersProviderT): EndpointRuleSetHttpAuthSchemeParametersProvider;
}

/**
 * @internal
 */
export interface EndpointRuleSetHttpAuthSchemeParametersProvider<
  C extends object = object,
  EndpointParametersT extends EndpointParameters = EndpointParameters,
  HttpAuthSchemeParametersT extends HttpAuthSchemeParameters = HttpAuthSchemeParameters
> extends HttpAuthSchemeParametersProvider<C, HttpAuthSchemeParametersT & EndpointParametersT> {}

/**
 * @internal
 */
export const createEndpointRuleSetHttpAuthSchemeParametersProvider: CreateEndpointRuleSetHttpAuthSchemeParametersProvider = <
  HttpAuthSchemeParametersT extends HttpAuthSchemeParameters = HttpAuthSchemeParameters
>(
  defaultHttpAuthSchemeParametersProvider: HttpAuthSchemeParametersProvider<object, HttpAuthSchemeParametersT>
) => async (config, context: HandlerExecutionContext, input: Record<string, unknown>) => {
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
    input,
    { getEndpointParameterInstructions: instructionsFn! },
    { ...config }
  );
  return {
    ...defaultParameters,
    ...endpointParameters,
  };
};
