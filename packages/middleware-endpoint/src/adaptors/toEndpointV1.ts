import { parseUrl } from "@smithy/core/protocols";
import type { Endpoint, EndpointV2 } from "@smithy/types";

/**
 * @deprecated Use `toEndpointV1` from `@smithy/core/endpoints` instead.
 * @internal
 */
export const toEndpointV1 = (endpoint: string | Endpoint | EndpointV2): Endpoint => {
  if (typeof endpoint === "object") {
    if ("url" in endpoint) {
      // v2
      const v1Endpoint = parseUrl(endpoint.url);
      if (endpoint.headers) {
        v1Endpoint.headers = {};
        for (const [name, values] of Object.entries(endpoint.headers)) {
          v1Endpoint.headers[name.toLowerCase()] = values.join(", ");
        }
      }
      return v1Endpoint;
    }
    // v1
    return endpoint;
  }
  return parseUrl(endpoint);
};
