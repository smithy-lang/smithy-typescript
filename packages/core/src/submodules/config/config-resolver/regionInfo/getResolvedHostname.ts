/**
 * @internal
 * @deprecated unused for endpointRuleSets.
 */
export interface GetResolvedHostnameOptions {
  regionHostname?: string;
  partitionHostname?: string;
}

/**
 * @internal
 * @deprecated unused for endpointRuleSets.
 */
export const getResolvedHostname = (
  resolvedRegion: string,
  { regionHostname, partitionHostname }: GetResolvedHostnameOptions
): string | undefined =>
  regionHostname
    ? regionHostname
    : partitionHostname
      ? partitionHostname.replace("{region}", resolvedRegion)
      : undefined;
