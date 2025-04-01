import { loadConfig } from "@smithy/node-config-provider";

import { getEndpointUrlConfig } from "./getEndpointUrlConfig";

/**
 * @internal
 */
export const getEndpointFromConfig = async (serviceId?: string) => loadConfig(getEndpointUrlConfig(serviceId ?? ""))();
