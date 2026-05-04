/**
 * @internal
 * Reads the blob data into the onChunk consumer.
 */
export async function blobReader(
  blob: Blob,
  onChunk: (chunk: Uint8Array) => void,
  chunkSize: number = 1024 * 1024
): Promise<void> {
  const size = blob.size;
  let totalBytesRead = 0;

  while (totalBytesRead < size) {
    const slice: Blob = blob.slice(totalBytesRead, Math.min(size, totalBytesRead + chunkSize));
    onChunk(new Uint8Array(await slice.arrayBuffer()));
    totalBytesRead += slice.size;
  }
}
