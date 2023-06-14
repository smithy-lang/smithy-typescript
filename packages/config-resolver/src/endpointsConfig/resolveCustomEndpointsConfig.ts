import { Endpoint, Provider, UrlParser } from "@smithy/types";
import { normalizeProvider } from "@smithy/util-middleware";

import { EndpointsInputConfig, EndpointsResolvedConfig } from "./resolveEndpointsConfig";

/**
 * @internal
 */
export interface CustomEndpointsInputConfig extends EndpointsInputConfig {
  /**
   * The fully qualified endpoint of the webservice.
   */
  endpoint: string | Endpoint | Provider<Endpoint>;
}

interface PreviouslyResolved {
  urlParser: UrlParser;
}

/**
 * @internal
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
 */
export const resolveCustomEndpointsConfig = <T>(
  input: T & CustomEndpointsInputConfig & PreviouslyResolved
): T & CustomEndpointsResolvedConfig => {
  const { endpoint, urlParser } = input;
  return {
    ...input,
    tls: input.tls ?? true,
    endpoint: normalizeProvider(typeof endpoint === "string" ? urlParser(endpoint) : endpoint),
    isCustomEndpoint: true,
    useDualstackEndpoint: normalizeProvider(input.useDualstackEndpoint ?? false),
  };
};
