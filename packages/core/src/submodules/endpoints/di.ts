import { getEndpointFromConfig } from "./middleware-endpoint/adaptors/getEndpointFromConfig.browser";

/**
 * @internal
 */
export const container: {
  getEndpointFromConfig: typeof getEndpointFromConfig;
} = {
  getEndpointFromConfig,
};
