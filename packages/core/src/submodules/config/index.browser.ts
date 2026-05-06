const no = Symbol.for("node-only");

// @smithy/property-provider
export { ProviderError, type ProviderErrorOptionsType } from "./property-provider/ProviderError";
export { CredentialsProviderError } from "./property-provider/CredentialsProviderError";
export { TokenProviderError } from "./property-provider/TokenProviderError";
export { chain } from "./property-provider/chain";
export { fromValue } from "./property-provider/fromValue";
export { memoize } from "./property-provider/memoize";

// @smithy/util-config-provider
export { booleanSelector } from "./util-config-provider/booleanSelector";
export { numberSelector } from "./util-config-provider/numberSelector";
export { SelectorType } from "./util-config-provider/types";

// @smithy/shared-ini-file-loader
export const getHomeDir = no;
export const ENV_PROFILE = no;
export const DEFAULT_PROFILE = "default";
export const getProfileName = no;
export const getSSOTokenFilepath = no;
export const getSSOTokenFromFile = no;
export const CONFIG_PREFIX_SEPARATOR = no;
export const loadSharedConfigFiles = no;
export const loadSsoSessionData = no;
export const parseKnownFiles = no;
export const externalDataInterceptor = no;
export const readFile = no;
export type { SSOToken } from "./shared-ini-file-loader/getSSOTokenFromFile";
export type { SharedConfigInit } from "./shared-ini-file-loader/loadSharedConfigFiles";
export type { SsoSessionInit } from "./shared-ini-file-loader/loadSsoSessionData";
export type { SourceProfileInit } from "./shared-ini-file-loader/parseKnownFiles";
export type { Profile, ParsedIniData, SharedConfigFiles } from "./shared-ini-file-loader/types";
export type { ReadFileOptions } from "./shared-ini-file-loader/readFile";

// @smithy/node-config-provider
export const loadConfig = no;
export const fromStatic = no;
export type { LocalConfigOptions, LoadedConfigSelectors } from "./node-config-provider/configLoader";
export type { EnvOptions, GetterFromEnv } from "./node-config-provider/fromEnv";
export type { NodeSharedConfigInit, GetterFromConfig } from "./node-config-provider/fromSharedConfigFiles";

// @smithy/config-resolver
export const ENV_USE_DUALSTACK_ENDPOINT = no;
export const CONFIG_USE_DUALSTACK_ENDPOINT = no;
export const DEFAULT_USE_DUALSTACK_ENDPOINT = false;
export const NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS = no;
export const nodeDualstackConfigSelectors = no;
export const ENV_USE_FIPS_ENDPOINT = no;
export const CONFIG_USE_FIPS_ENDPOINT = no;
export const DEFAULT_USE_FIPS_ENDPOINT = false;
export const NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS = no;
export const nodeFipsConfigSelectors = no;
export {
  resolveCustomEndpointsConfig,
  type CustomEndpointsInputConfig,
  type CustomEndpointsResolvedConfig,
} from "./config-resolver/endpointsConfig/resolveCustomEndpointsConfig";
export {
  resolveEndpointsConfig,
  type EndpointsInputConfig,
  type EndpointsResolvedConfig,
} from "./config-resolver/endpointsConfig/resolveEndpointsConfig";

// @smithy/config-resolver
export const REGION_ENV_NAME = no;
export const REGION_INI_NAME = no;
export const NODE_REGION_CONFIG_OPTIONS = no;
export const NODE_REGION_CONFIG_FILE_OPTIONS = no;
export {
  resolveRegionConfig,
  type RegionInputConfig,
  type RegionResolvedConfig,
} from "./config-resolver/regionConfig/resolveRegionConfig";

// @smithy/config-resolver
export { type PartitionHash } from "./config-resolver/regionInfo/PartitionHash";
export { type RegionHash } from "./config-resolver/regionInfo/RegionHash";
export { type EndpointVariant } from "./config-resolver/regionInfo/EndpointVariant";
export { type EndpointVariantTag } from "./config-resolver/regionInfo/EndpointVariantTag";
export { getRegionInfo, type GetRegionInfoOptions } from "./config-resolver/regionInfo/getRegionInfo";

// @smithy/util-defaults-mode-browser
export {
  resolveDefaultsModeConfig,
  type ResolveDefaultsModeConfigOptions,
} from "./defaults-mode/resolveDefaultsModeConfig.browser";
