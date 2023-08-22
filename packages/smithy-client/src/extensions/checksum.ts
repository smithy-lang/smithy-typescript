import type { ChecksumAlgorithm, ChecksumConfiguration, ChecksumConstructor, HashConstructor } from "@smithy/types";
import { AlgorithmId } from "@smithy/types";

export { AlgorithmId, ChecksumAlgorithm, ChecksumConfiguration };

/**
 * @internal
 */
export type PartialChecksumRuntimeConfigType = Partial<{
  sha256: ChecksumConstructor | HashConstructor;
  md5: ChecksumConstructor | HashConstructor;
  crc32: ChecksumConstructor | HashConstructor;
  crc32c: ChecksumConstructor | HashConstructor;
  sha1: ChecksumConstructor | HashConstructor;
}>;

/**
 * @internal
 */
export const getChecksumConfiguration = (runtimeConfig: PartialChecksumRuntimeConfigType) => {
  const checksumAlgorithms: ChecksumAlgorithm[] = [];

  for (const id in AlgorithmId) {
    const algorithmId = AlgorithmId[id as keyof typeof AlgorithmId];
    if (runtimeConfig[algorithmId] === undefined) {
      continue;
    }
    checksumAlgorithms.push({
      algorithmId: () => algorithmId,
      checksumConstructor: () => runtimeConfig[algorithmId]!,
    });
  }

  return {
    _checksumAlgorithms: checksumAlgorithms,
    addChecksumAlgorithm(algo: ChecksumAlgorithm): void {
      this._checksumAlgorithms.push(algo);
    },
    checksumAlgorithms(): ChecksumAlgorithm[] {
      return this._checksumAlgorithms;
    },
  };
};

/**
 * @internal
 */
export const resolveChecksumRuntimeConfig = (clientConfig: ChecksumConfiguration): PartialChecksumRuntimeConfigType => {
  const runtimeConfig: PartialChecksumRuntimeConfigType = {};
  clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
    runtimeConfig[checksumAlgorithm.algorithmId()] = checksumAlgorithm.checksumConstructor();
  });

  return runtimeConfig;
};
