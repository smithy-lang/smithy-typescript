import { EndpointParameters, EndpointV2, Logger } from "@smithy/types";

import { HttpAuthOption } from "./HttpAuthScheme";
import { HttpAuthSchemeParameters, HttpAuthSchemeProvider } from "./HttpAuthSchemeProvider";

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
