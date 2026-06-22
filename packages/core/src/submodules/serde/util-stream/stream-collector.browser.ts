import { concatBytes } from "../concatBytes";
import { isBlob } from "./stream-type-check";

/**
 * @internal
 */
export const streamCollector = async (stream: Blob | ReadableStream): Promise<Uint8Array> => {
  if (isBlob(stream)) {
    return collectBlob(stream as Blob);
  }
  return collectReadableStream(stream as ReadableStream);
};

/**
 * @internal
 */
export async function collectBlob(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((ab) => new Uint8Array(ab));
}

/**
 * @internal
 */
export async function collectReadableStream(stream: ReadableStream): Promise<Uint8Array> {
  const chunks = [];
  const reader = stream.getReader();
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      chunks.push(value);
      length += value.length;
    }
    if (done) {
      break;
    }
  }
  return concatBytes(chunks, length);
}
