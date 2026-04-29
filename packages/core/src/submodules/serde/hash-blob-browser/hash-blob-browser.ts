import type { ChecksumConstructor, HashConstructor, StreamHasher } from "@smithy/types";

import { blobReader } from "../chunked-blob-reader/chunked-blob-reader";

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
