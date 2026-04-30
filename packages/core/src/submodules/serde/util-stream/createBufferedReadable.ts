import type { Logger } from "@smithy/types";
import { Readable } from "node:stream";

import { ByteArrayCollector } from "./ByteArrayCollector";
import type { BufferStore, Modes } from "./createBufferedReadableStream";
import { createBufferedReadableStream, flush, merge, modeOf, sizeOf } from "./createBufferedReadableStream";
import { isReadableStream } from "./stream-type-check";

/**
 * @internal
 * @param upstream - any Readable or ReadableStream.
 * @param size - byte or character length minimum. Buffering occurs when a chunk fails to meet this value.
 * @param logger - for emitting warnings when buffering occurs.
 * @returns another stream of the same data and stream class, but buffers chunks until
 * the minimum size is met, except for the last chunk.
 */
export function createBufferedReadable(upstream: Readable, size: number, logger?: Logger): Readable;
/**
 * @internal
 */
export function createBufferedReadable(upstream: ReadableStream, size: number, logger?: Logger): ReadableStream;
/**
 * @internal
 */
export function createBufferedReadable(
  upstream: Readable | ReadableStream,
  size: number,
  logger?: Logger
): Readable | ReadableStream {
  if (isReadableStream(upstream)) {
    return createBufferedReadableStream(upstream, size, logger);
  }
  const downstream = new Readable({ read() {} });
  let streamBufferingLoggedWarning = false;
  let bytesSeen = 0;

  const buffers = [
    "",
    new ByteArrayCollector((size) => new Uint8Array(size)),
    new ByteArrayCollector((size) => Buffer.from(new Uint8Array(size))),
  ] as BufferStore;
  let mode: Modes | -1 = -1;

  upstream.on("data", (chunk) => {
    const chunkMode = modeOf(chunk, true);
    if (mode !== chunkMode) {
      if (mode >= 0) {
        downstream.push(flush(buffers, mode));
      }
      mode = chunkMode;
    }
    if (mode === -1) {
      downstream.push(chunk);
      return;
    }

    const chunkSize = sizeOf(chunk);
    bytesSeen += chunkSize;
    const bufferSize = sizeOf(buffers[mode]);
    if (chunkSize >= size && bufferSize === 0) {
      // skip writing to the intermediate buffer
      // because the upstream chunk is already large enough.
      downstream.push(chunk);
    } else {
      // buffer and potentially flush the data downstream.
      const newSize = merge(buffers, mode, chunk);
      if (!streamBufferingLoggedWarning && bytesSeen > size * 2) {
        streamBufferingLoggedWarning = true;
        logger?.warn(
          `@smithy/util-stream - stream chunk size ${chunkSize} is below threshold of ${size}, automatically buffering.`
        );
      }
      if (newSize >= size) {
        downstream.push(flush(buffers, mode));
      }
    }
  });
  upstream.on("end", () => {
    if (mode !== -1) {
      const remainder = flush(buffers, mode);
      if (sizeOf(remainder) > 0) {
        downstream.push(remainder);
      }
    }
    downstream.push(null);
  });

  return downstream;
}
