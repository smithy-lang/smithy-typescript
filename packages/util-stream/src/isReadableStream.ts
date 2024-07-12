/**
 * @internal
 */
export const isReadableStreamInstance = (stream: unknown): stream is ReadableStream =>
  typeof ReadableStream === "function" && stream?.constructor?.name === ReadableStream.name;
