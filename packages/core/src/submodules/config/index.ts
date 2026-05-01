// property-provider
export { ProviderError, ProviderErrorOptionsType } from "./property-provider/ProviderError";
export { CredentialsProviderError } from "./property-provider/CredentialsProviderError";
export { TokenProviderError } from "./property-provider/TokenProviderError";
export { chain } from "./property-provider/chain";
export { fromValue } from "./property-provider/fromValue";
export { memoize } from "./property-provider/memoize";

// util-config-provider
export { booleanSelector } from "./util-config-provider/booleanSelector";
export { numberSelector } from "./util-config-provider/numberSelector";
export { SelectorType } from "./util-config-provider/types";

// shared-ini-file-loader
export { getHomeDir } from "./shared-ini-file-loader/getHomeDir";
export { ENV_PROFILE, DEFAULT_PROFILE, getProfileName } from "./shared-ini-file-loader/getProfileName";
export { getSSOTokenFilepath } from "./shared-ini-file-loader/getSSOTokenFilepath";
export { getSSOTokenFromFile, SSOToken } from "./shared-ini-file-loader/getSSOTokenFromFile";
export { CONFIG_PREFIX_SEPARATOR } from "./shared-ini-file-loader/constants";
export { SharedConfigInit, loadSharedConfigFiles } from "./shared-ini-file-loader/loadSharedConfigFiles";
export { SsoSessionInit, loadSsoSessionData } from "./shared-ini-file-loader/loadSsoSessionData";
export { SourceProfileInit, parseKnownFiles } from "./shared-ini-file-loader/parseKnownFiles";
export { externalDataInterceptor } from "./shared-ini-file-loader/externalDataInterceptor";
export { Profile, ParsedIniData, SharedConfigFiles } from "./shared-ini-file-loader/types";
export { ReadFileOptions, readFile } from "./shared-ini-file-loader/readFile";

// node-config-provider
export { loadConfig, LocalConfigOptions, LoadedConfigSelectors } from "./node-config-provider/configLoader";
export { EnvOptions, GetterFromEnv } from "./node-config-provider/fromEnv";
export { fromStatic } from "./node-config-provider/fromStatic";
export { NodeSharedConfigInit, GetterFromConfig } from "./node-config-provider/fromSharedConfigFiles";

// config-resolver - endpointsConfig
export {
  ENV_USE_DUALSTACK_ENDPOINT,
  CONFIG_USE_DUALSTACK_ENDPOINT,
  DEFAULT_USE_DUALSTACK_ENDPOINT,
  NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS,
  nodeDualstackConfigSelectors,
} from "./config-resolver/endpointsConfig/NodeUseDualstackEndpointConfigOptions";
export {
  ENV_USE_FIPS_ENDPOINT,
  CONFIG_USE_FIPS_ENDPOINT,
  DEFAULT_USE_FIPS_ENDPOINT,
  NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS,
  nodeFipsConfigSelectors,
} from "./config-resolver/endpointsConfig/NodeUseFipsEndpointConfigOptions";
export {
  CustomEndpointsInputConfig,
  CustomEndpointsResolvedConfig,
  resolveCustomEndpointsConfig,
} from "./config-resolver/endpointsConfig/resolveCustomEndpointsConfig";
export {
  EndpointsInputConfig,
  EndpointsResolvedConfig,
  resolveEndpointsConfig,
} from "./config-resolver/endpointsConfig/resolveEndpointsConfig";

// config-resolver - regionConfig
export {
  REGION_ENV_NAME,
  REGION_INI_NAME,
  NODE_REGION_CONFIG_OPTIONS,
  NODE_REGION_CONFIG_FILE_OPTIONS,
} from "./config-resolver/regionConfig/config";
export {
  RegionInputConfig,
  RegionResolvedConfig,
  resolveRegionConfig,
} from "./config-resolver/regionConfig/resolveRegionConfig";

// config-resolver - regionInfo
export { PartitionHash } from "./config-resolver/regionInfo/PartitionHash";
export { RegionHash } from "./config-resolver/regionInfo/RegionHash";
export { EndpointVariant } from "./config-resolver/regionInfo/EndpointVariant";
export { EndpointVariantTag } from "./config-resolver/regionInfo/EndpointVariantTag";
export { GetRegionInfoOptions, getRegionInfo } from "./config-resolver/regionInfo/getRegionInfo";

// defaults-mode (node default, browser variant, native variant)
export { ResolveDefaultsModeConfigOptions, resolveDefaultsModeConfig } from "./defaults-mode/resolveDefaultsModeConfig";
