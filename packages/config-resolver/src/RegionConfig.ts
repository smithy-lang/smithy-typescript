import { Provider } from "@aws-sdk/types";

export interface RegionConfigInput {
  /**
   * The AWS region to which this client will send requests
   */
  region?: string | Provider<string>;
}
interface PreviouslyResolved {
  regionDefaultProvider: (input: any) => Provider<string>;
}
export interface RegionConfigResolved {
  region: Provider<string>;
}
export function resolveRegionConfig<T>(
  input: T & RegionConfigInput & PreviouslyResolved
): T & RegionConfigResolved {
  let region = input.region || input.regionDefaultProvider(input as any);
  return {
    ...input,
    region: normalizeRegion(region)
  };
}

function normalizeRegion(region: string | Provider<string>): Provider<string> {
  if (typeof region === "string") {
    const promisified = Promise.resolve(region);
    return () => promisified;
  }
  return region as Provider<string>;
}
