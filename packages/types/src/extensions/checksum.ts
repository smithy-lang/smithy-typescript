import { ChecksumConstructor } from "../checksum";
import { HashConstructor } from "../crypto";

/**
 * @internal
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
 */
export interface ChecksumAlgorithm {
  algorithmId(): AlgorithmId;
  checksumConstructor(): ChecksumConstructor | HashConstructor;
}

export interface ChecksumConfiguration {
  addChecksumAlgorithm(algo: ChecksumAlgorithm): void;
  checksumAlgorithms(): ChecksumAlgorithm[];

  [other: string | number | symbol]: any;
}

type GetChecksumConfigurationType = (
  runtimeConfig: Partial<{
    sha256: ChecksumConstructor | HashConstructor;
    md5: ChecksumConstructor | HashConstructor;
  }>
) => ChecksumConfiguration;

/**
 * @internal
 */
export const getChecksumConfiguration: GetChecksumConfigurationType = (
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

type ResolveChecksumRuntimeConfigType = (clientConfig: ChecksumConfiguration) => any;

/**
 * @internal
 */
export const resolveChecksumRuntimeConfig: ResolveChecksumRuntimeConfigType = (clientConfig: ChecksumConfiguration) => {
  const runtimeConfig: any = {};

  clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
    runtimeConfig[checksumAlgorithm.algorithmId()] = checksumAlgorithm.checksumConstructor();
  });

  return runtimeConfig;
};
