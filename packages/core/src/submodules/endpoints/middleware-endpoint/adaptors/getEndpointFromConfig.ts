import { loadConfig } from "@smithy/core/config";

import { getEndpointUrlConfig } from "./getEndpointUrlConfig";
import { ignoreConfiguredEndpointUrlsConfigSelectors } from "./getIgnoreConfiguredEndpointUrls";

/**
 * @internal
 */
export const getEndpointFromConfig = async (serviceId?: string): Promise<string | undefined> => {
  const ignore = await loadConfig(ignoreConfiguredEndpointUrlsConfigSelectors)();
  if (ignore) {
    return undefined;
  }
  return loadConfig(getEndpointUrlConfig(serviceId ?? ""))();
};
