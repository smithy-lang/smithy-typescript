import { loadConfig } from "@smithy/core/config";

import { getEndpointUrlConfig } from "./getEndpointUrlConfig";

/**
 * @internal
 */
export const getEndpointFromConfig = async (serviceId?: string) => loadConfig(getEndpointUrlConfig(serviceId ?? ""))();
