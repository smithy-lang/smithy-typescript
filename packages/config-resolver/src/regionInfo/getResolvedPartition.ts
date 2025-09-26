import type { PartitionHash } from "./PartitionHash";

/**
 * @internal
 * @deprecated unused for endpointRuleSets.
 */
export interface GetResolvedPartitionOptions {
  partitionHash: PartitionHash;
}

/**
 * @internal
 * @deprecated unused for endpointRuleSets.
 */
export const getResolvedPartition = (region: string, { partitionHash }: GetResolvedPartitionOptions) =>
  Object.keys(partitionHash || {}).find((key) => partitionHash[key].regions.includes(region)) ?? "aws";
