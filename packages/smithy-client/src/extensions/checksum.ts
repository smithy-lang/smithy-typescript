import type { ChecksumConstructor, HashConstructor } from "@smithy/types";

/**
 * @internal
 *
 * @deprecated will be imported from types.
 */
export enum AlgorithmId {
  MD5 = "md5",
  CRC32 = "crc32",
  CRC32C = "crc32c",
  SHA1 = "sha1",
  SHA256 = "sha256",
}

/**
 * @internal
 *
 * @deprecated will be imported from types.
 */
export interface ChecksumAlgorithm {
  algorithmId(): AlgorithmId;
  checksumConstructor(): ChecksumConstructor | HashConstructor;
}

/**
 * @internal
 *
 * @deprecated will be imported from types.
 */
export interface ChecksumConfiguration {
  addChecksumAlgorithm(algo: ChecksumAlgorithm): void;
  checksumAlgorithms(): ChecksumAlgorithm[];
}

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
