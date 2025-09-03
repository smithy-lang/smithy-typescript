import type { Endpoint, Provider, UrlParser } from "@smithy/types";
import { normalizeProvider } from "@smithy/util-middleware";

import type { EndpointsInputConfig, EndpointsResolvedConfig } from "./resolveEndpointsConfig";

/**
 * @public
 * @deprecated superseded by default endpointRuleSet generation.
 */
export interface CustomEndpointsInputConfig extends EndpointsInputConfig {
  /**
   * The fully qualified endpoint of the webservice.
   */
  endpoint: string | Endpoint | Provider<Endpoint>;
}

/**
 * @internal
 * @deprecated superseded by default endpointRuleSet generation.
 */
interface PreviouslyResolved {
  urlParser: UrlParser;
}

/**
 * @internal
 * @deprecated superseded by default endpointRuleSet generation.
 */
export interface CustomEndpointsResolvedConfig extends EndpointsResolvedConfig {
  /**
   * Whether the endpoint is specified by caller.
   * @internal
   */
  isCustomEndpoint: true;
}

/**
 * @internal
 *
 * @deprecated superseded by default endpointRuleSet generation.
 */
export const resolveCustomEndpointsConfig = <T>(
  input: T & CustomEndpointsInputConfig & PreviouslyResolved
): T & CustomEndpointsResolvedConfig => {
  const { tls, endpoint, urlParser, useDualstackEndpoint } = input;
  return Object.assign(input, {
    tls: tls ?? true,
    endpoint: normalizeProvider(typeof endpoint === "string" ? urlParser(endpoint) : endpoint),
    isCustomEndpoint: true,
    useDualstackEndpoint: normalizeProvider(useDualstackEndpoint ?? false),
  } as CustomEndpointsResolvedConfig);
};
