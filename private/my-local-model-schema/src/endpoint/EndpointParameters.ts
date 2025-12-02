// smithy-typescript generated code
import type { Endpoint, EndpointParameters as __EndpointParameters, EndpointV2, Provider } from "@smithy/types";

/**
 * @public
 */
export interface ClientInputEndpointParameters {
  clientContextParams?: {
    apiKey?: string | undefined | Provider<string | undefined>;
    customParam?: string | undefined | Provider<string | undefined>;
  };
  endpoint?: string | Provider<string> | Endpoint | Provider<Endpoint> | EndpointV2 | Provider<EndpointV2>;
  apiKey?: string | undefined | Provider<string | undefined>;
  customParam?: string | undefined | Provider<string | undefined>;
}

export type ClientResolvedEndpointParameters = Omit<
  ClientInputEndpointParameters,
  "endpoint" | "clientContextParams"
> & {
  defaultSigningName: string;
  clientContextParams: {
    apiKey?: string | undefined | Provider<string | undefined>;
    customParam?: string | undefined | Provider<string | undefined>;
  };
};

/**
 * @internal
 */
const clientContextParamDefaults = {
  apiKey: "default-api-key",
  customParam: "default-custom-value",
} as const;

export const resolveClientEndpointParameters = <T>(
  options: T & ClientInputEndpointParameters
): T & ClientResolvedEndpointParameters => {
  return Object.assign(options, {
    apiKey: options.apiKey ?? "default-api-key",
    customParam: options.customParam ?? "default-custom-value",
    defaultSigningName: "",
    clientContextParams: Object.assign(clientContextParamDefaults, options.clientContextParams),
  });
};

/**
 * @internal
 */
export const commonParams = {
  apiKey: { type: "clientContextParams", name: "apiKey" },
  customParam: { type: "clientContextParams", name: "customParam" },
  endpoint: { type: "builtInParams", name: "endpoint" },
} as const;

/**
 * @internal
 */
export interface EndpointParameters extends __EndpointParameters {
  endpoint: string;
  apiKey?: string | undefined;
  customParam?: string | undefined;
}
