// smithy-typescript generated code
import type { Endpoint, EndpointParameters as __EndpointParameters, EndpointV2, Provider } from "@smithy/types";

/**
 * @public
 */
export interface ClientInputEndpointParameters {
  clientContextParams?: {
    apiKey?: string | undefined | Provider<string | undefined>;
    customParam?: string | undefined | Provider<string | undefined>;
    enableFeature?: boolean | undefined | Provider<boolean | undefined>;
    debugMode?: boolean | undefined | Provider<boolean | undefined>;
    nonConflictingParam?: string | undefined | Provider<string | undefined>;
  };
  endpoint?: string | Provider<string> | Endpoint | Provider<Endpoint> | EndpointV2 | Provider<EndpointV2>;
  apiKey?: string | undefined | Provider<string | undefined>;
  customParam?: string | undefined | Provider<string | undefined>;
  enableFeature?: boolean | undefined | Provider<boolean | undefined>;
  debugMode?: boolean | undefined | Provider<boolean | undefined>;
  nonConflictingParam?: string | undefined | Provider<string | undefined>;
}

/**
 * @public
 */
export type ClientResolvedEndpointParameters = Omit<ClientInputEndpointParameters, "endpoint"> & {
  defaultSigningName: string;
};

/**
 * @internal
 */
const clientContextParamDefaults = {
  nonConflictingParam: "non-conflict-default",
  customParam: "default-custom-value",
  debugMode: false,
  enableFeature: true,
} as const;

/**
 * @internal
 */
export const resolveClientEndpointParameters = <T>(
  options: T & ClientInputEndpointParameters
): T & ClientResolvedEndpointParameters => {
  return Object.assign(options, {
    customParam: options.customParam ?? "default-custom-value",
    enableFeature: options.enableFeature ?? true,
    debugMode: options.debugMode ?? false,
    nonConflictingParam: options.nonConflictingParam ?? "non-conflict-default",
    defaultSigningName: "",
    clientContextParams: Object.assign(clientContextParamDefaults, options.clientContextParams),
  });
};

/**
 * @internal
 */
export const commonParams = {
  ApiKey: { type: "clientContextParams", name: "apiKey" },
  nonConflictingParam: { type: "clientContextParams", name: "nonConflictingParam" },
  region: { type: "clientContextParams", name: "region" },
  customParam: { type: "clientContextParams", name: "customParam" },
  debugMode: { type: "clientContextParams", name: "debugMode" },
  enableFeature: { type: "clientContextParams", name: "enableFeature" },
  endpoint: { type: "builtInParams", name: "endpoint" },
} as const;

/**
 * @internal
 */
export interface EndpointParameters extends __EndpointParameters {
  endpoint: string;
  ApiKey?: string | undefined;
  region?: string | undefined;
  customParam?: string | undefined;
  enableFeature?: boolean | undefined;
  debugMode?: boolean | undefined;
  nonConflictingParam?: string | undefined;
}
