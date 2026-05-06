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

// @smithy/config-resolver
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
