import type { ChecksumAlgorithm, ChecksumConfiguration, ChecksumConstructor, HashConstructor } from "@smithy/types";
import { AlgorithmId } from "@smithy/types";

export { AlgorithmId, ChecksumAlgorithm, ChecksumConfiguration };

/**
 * @internal
 */
export const getChecksumConfiguration = (
  runtimeConfig: Partial<{
    sha256: ChecksumConstructor | HashConstructor;
    md5: ChecksumConstructor | HashConstructor;
  }>
) => {
  const checksumAlgorithms: ChecksumAlgorithm[] = [];

  if (runtimeConfig.sha256 !== undefined) {
    checksumAlgorithms.push({
      algorithmId: () => AlgorithmId.SHA256,
      checksumConstructor: () => runtimeConfig.sha256!,
    });
  }

  if (runtimeConfig.md5 != undefined) {
    checksumAlgorithms.push({
      algorithmId: () => AlgorithmId.MD5,
      checksumConstructor: () => runtimeConfig.md5!,
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
export const resolveChecksumRuntimeConfig = (clientConfig: ChecksumConfiguration) => {
  const runtimeConfig: Partial<Record<AlgorithmId, HashConstructor | ChecksumConstructor>> = {};

  clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
    runtimeConfig[checksumAlgorithm.algorithmId()] = checksumAlgorithm.checksumConstructor();
  });

  return runtimeConfig;
};
