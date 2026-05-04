import { parseUrl } from "@smithy/core/protocols";
import type { Endpoint, EndpointV2 } from "@smithy/types";

/**
 * Converts an endpoint to EndpointV1 format.
 * @internal
 */
export const toEndpointV1 = (endpoint: string | Endpoint | EndpointV2): Endpoint => {
  if (typeof endpoint === "object") {
    if ("url" in endpoint) {
      // v2
      const v1Endpoint = parseUrl(endpoint.url);
      if (endpoint.headers) {
        v1Endpoint.headers = {};
        for (const name in endpoint.headers) {
          v1Endpoint.headers[name.toLowerCase()] = endpoint.headers[name].join(", ");
        }
      }
      return v1Endpoint;
    }
    // v1
    return endpoint;
  }
  return parseUrl(endpoint);
};
