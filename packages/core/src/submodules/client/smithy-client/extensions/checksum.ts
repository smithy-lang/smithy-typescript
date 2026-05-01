import type { ChecksumAlgorithm, ChecksumConfiguration, ChecksumConstructor, HashConstructor } from "@smithy/types";
import { AlgorithmId } from "@smithy/types";

export { AlgorithmId, ChecksumAlgorithm, ChecksumConfiguration };

/**
 * @internal
 */
const knownAlgorithms: string[] = Object.values(AlgorithmId);

/**
 * @internal
 */
export type PartialChecksumRuntimeConfigType = {
  checksumAlgorithms?: Record<string, ChecksumConstructor | HashConstructor>;
  sha256?: ChecksumConstructor | HashConstructor;
  md5?: ChecksumConstructor | HashConstructor;
  crc32?: ChecksumConstructor | HashConstructor;
  crc32c?: ChecksumConstructor | HashConstructor;
  sha1?: ChecksumConstructor | HashConstructor;
};

/**
 * @param runtimeConfig - config object of the client instance.
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
  for (const [id, ChecksumCtor] of Object.entries(runtimeConfig.checksumAlgorithms ?? {})) {
    checksumAlgorithms.push({
      algorithmId: () => id,
      checksumConstructor: () => ChecksumCtor,
    });
  }
  return {
    addChecksumAlgorithm(algo: ChecksumAlgorithm): void {
      runtimeConfig.checksumAlgorithms = runtimeConfig.checksumAlgorithms ?? {};
      const id = algo.algorithmId();
      const ctor = algo.checksumConstructor();
      if (knownAlgorithms.includes(id)) {
        runtimeConfig.checksumAlgorithms[id.toUpperCase()] = ctor;
      } else {
        runtimeConfig.checksumAlgorithms[id] = ctor;
      }
      checksumAlgorithms.push(algo);
    },
    checksumAlgorithms(): ChecksumAlgorithm[] {
      return checksumAlgorithms;
    },
  };
};

/**
 * @internal
 */
export const resolveChecksumRuntimeConfig = (clientConfig: ChecksumConfiguration): PartialChecksumRuntimeConfigType => {
  const runtimeConfig: PartialChecksumRuntimeConfigType = {};
  clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
    const id = checksumAlgorithm.algorithmId();
    if (knownAlgorithms.includes(id)) {
      runtimeConfig[id as AlgorithmId] = checksumAlgorithm.checksumConstructor();
    }
    // else the algorithm was attached to the checksumAlgorithms object on the client config already.
  });

  return runtimeConfig;
};
