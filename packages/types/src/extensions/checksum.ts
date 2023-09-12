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

/**
 * @deprecated unused.
 */
type ChecksumCnnfigurationLegacy = {
	/**
     * @deprecated unused.
     */
    [other in string | number]: any;
}

/**
 * @internal
 */
export interface ChecksumConfiguration extends ChecksumCnnfigurationLegacy {
    addChecksumAlgorithm(algo: ChecksumAlgorithm): void;
    checksumAlgorithms(): ChecksumAlgorithm[];
}

/**
 * @deprecated will be removed for implicit type.
 */
type GetChecksumConfigurationType = (
  runtimeConfig: Partial<{
    sha256: ChecksumConstructor | HashConstructor;
    md5: ChecksumConstructor | HashConstructor;
  }>
) => ChecksumConfiguration;

/**
 * @internal
 * @deprecated will be moved to smithy-client.
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

/**
 * @deprecated will be removed for implicit type.
 */
type ResolveChecksumRuntimeConfigType = (clientConfig: ChecksumConfiguration) => any;

/**
 * @internal
 *
 * @deprecated will be moved to smithy-client.
 */
export const resolveChecksumRuntimeConfig: ResolveChecksumRuntimeConfigType = (clientConfig: ChecksumConfiguration) => {
  const runtimeConfig: any = {};

  clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
    runtimeConfig[checksumAlgorithm.algorithmId()] = checksumAlgorithm.checksumConstructor();
  });

  return runtimeConfig;
};
