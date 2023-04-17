import { blobReader } from "@smithy-io/chunked-blob-reader";
import { ChecksumConstructor, HashConstructor, StreamHasher } from "@smithy-io/types";

/**
 * @internal
 */
export const blobHasher: StreamHasher<Blob> = async function blobHasher(
  hashCtor: ChecksumConstructor | HashConstructor,
  blob: Blob
): Promise<Uint8Array> {
  const hash = new hashCtor();

  await blobReader(blob, (chunk) => {
    hash.update(chunk);
  });

  return hash.digest();
};
