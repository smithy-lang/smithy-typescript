import { LoadedConfigSelectors } from "@smithy/node-config-provider";

import { EndpointMode } from "./EndpointMode";

/**
 * @internal
 */
export const ENV_ENDPOINT_MODE_NAME = "AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE";
/**
 * @internal
 */
export const CONFIG_ENDPOINT_MODE_NAME = "ec2_metadata_service_endpoint_mode";

/**
 * @internal
 */
export const ENDPOINT_MODE_CONFIG_OPTIONS: LoadedConfigSelectors<string | undefined> = {
  environmentVariableSelector: (env) => env[ENV_ENDPOINT_MODE_NAME],
  configFileSelector: (profile) =>
    typeof profile[CONFIG_ENDPOINT_MODE_NAME] === "string" ? profile[CONFIG_ENDPOINT_MODE_NAME] : undefined,
  default: EndpointMode.IPv4,
};
