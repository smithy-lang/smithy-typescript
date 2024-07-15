import type { Readable } from "stream";
import { PassThrough } from "stream";

import { isReadableStream } from "./stream-type-check";
import { splitStream as splitWebStream } from "./splitStream.browser";

/**
 * @param stream
 * @returns stream split into two identical streams.
 */
export async function splitStream(stream: Readable): Promise<[Readable, Readable]>;
export async function splitStream(stream: ReadableStream): Promise<[ReadableStream, ReadableStream]>;
export async function splitStream(
  stream: Readable | ReadableStream
): Promise<[Readable | ReadableStream, Readable | ReadableStream]> {
  if (isReadableStream(stream)) {
    return splitWebStream(stream);
  }
  const stream1 = new PassThrough();
  const stream2 = new PassThrough();
  stream.pipe(stream1);
  stream.pipe(stream2);
  return [stream1, stream2];
}
