import type { Endpoint, EndpointV2 } from "@smithy/types";
import { parseUrl } from "@smithy/url-parser";

/**
 * @internal
 */
export const toEndpointV1 = (endpoint: string | Endpoint | EndpointV2): Endpoint => {
  if (typeof endpoint === "object") {
    if ("url" in endpoint) {
      // v2
      const parsed = parseUrl(endpoint.url);
      if (endpoint.headers) {
        parsed.headers = {};
        for (const [name, values] of Object.entries(endpoint.headers)) {
          parsed.headers[name.toLowerCase()] = values.join(", ");
        }
      }
      return parsed;
    }
    // v1
    return endpoint;
  }
  return parseUrl(endpoint);
};
