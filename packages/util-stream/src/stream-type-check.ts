/**
 * @internal
 */
export const isReadableStream = (stream: unknown): stream is ReadableStream =>
  typeof ReadableStream === "function" &&
  (stream?.constructor?.name === ReadableStream.name || stream instanceof ReadableStream);
