/**
 * Alias prevents compiler from turning
 * ReadableStream into ReadableStream<any>, which is incompatible
 * with the NodeJS.ReadableStream global type.
 *
 * @internal
 */
type ReadableStreamType = ReadableStream;

/**
 * @internal
 */
export const isReadableStream = (stream: unknown): stream is ReadableStreamType =>
  typeof ReadableStream === "function" &&
  (stream?.constructor?.name === ReadableStream.name || stream instanceof ReadableStream);

/**
 * @internal
 */
export const isBlob = (blob: unknown): blob is Blob => {
  return typeof Blob === "function" && (blob?.constructor?.name === Blob.name || blob instanceof Blob);
};
