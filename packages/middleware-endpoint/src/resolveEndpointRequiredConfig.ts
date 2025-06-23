import { Endpoint, EndpointV2, Provider } from "@smithy/types";

/**
 * This is an additional config resolver layer for clients using the default
 * endpoints ruleset. It modifies the input and output config types to make
 * the endpoint configuration property required.
 *
 * It must be placed after the `resolveEndpointConfig`
 * resolver. This replaces the "CustomEndpoints" config resolver, which was used
 * prior to default endpoint rulesets.
 *
 * @public
 */
export interface EndpointRequiredInputConfig {
  endpoint: string | Endpoint | Provider<Endpoint> | EndpointV2 | Provider<EndpointV2>;
}

/**
 * @internal
 */
interface PreviouslyResolved {
  endpoint?: Provider<Endpoint>;
}

/**
 * @internal
 */
export interface EndpointRequiredResolvedConfig {
  endpoint: Provider<Endpoint>;
}

/**
 * @internal
 */
export const resolveEndpointRequiredConfig = <T>(
  input: T & EndpointRequiredInputConfig & PreviouslyResolved
): T & EndpointRequiredResolvedConfig => {
  const { endpoint } = input;
  if (endpoint === undefined) {
    input.endpoint = async () => {
      throw new Error(
        "@smithy/middleware-endpoint: (default endpointRuleSet) endpoint is not set - you must configure an endpoint."
      );
    };
  }
  return input as T & EndpointRequiredResolvedConfig;
};
