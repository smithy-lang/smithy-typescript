import { Provider, RegionInfoProvider, UrlParser } from "@smithy/types";

interface GetEndpointFromRegionOptions {
  region: Provider<string>;
  tls?: boolean;
  regionInfoProvider: RegionInfoProvider;
  urlParser: UrlParser;
  useDualstackEndpoint: Provider<boolean>;
  useFipsEndpoint: Provider<boolean>;
}

export const getEndpointFromRegion = async (input: GetEndpointFromRegionOptions) => {
  const { tls = true } = input;
  const region = await input.region();

  const dnsHostRegex = new RegExp(/^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])$/);
  if (!dnsHostRegex.test(region)) {
    throw new Error("Invalid region in client config");
  }

  const useDualstackEndpoint = await input.useDualstackEndpoint();
  const useFipsEndpoint = await input.useFipsEndpoint();
  const { hostname } = (await input.regionInfoProvider(region, { useDualstackEndpoint, useFipsEndpoint })) ?? {};
  if (!hostname) {
    throw new Error("Cannot resolve hostname from client config");
  }

  return input.urlParser(`${tls ? "https:" : "http:"}//${hostname}`);
};
