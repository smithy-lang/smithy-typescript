import type { Logger } from "@smithy/types";

import { ByteArrayCollector } from "./ByteArrayCollector";

export type BufferStore = [string, ByteArrayCollector, ByteArrayCollector?];
export type BufferUnion = string | Uint8Array;
export type Modes = 0 | 1 | 2;

/**
 * @internal
 * @param upstream - any ReadableStream.
 * @param size - byte or character length minimum. Buffering occurs when a chunk fails to meet this value.
 * @param onBuffer - for emitting warnings when buffering occurs.
 * @returns another stream of the same data, but buffers chunks until
 * the minimum size is met, except for the last chunk.
 */
export function createBufferedReadableStream(upstream: ReadableStream, size: number, logger?: Logger): ReadableStream {
  const reader = upstream.getReader();
  let streamBufferingLoggedWarning = false;
  let bytesSeen = 0;

  const buffers = ["", new ByteArrayCollector((size) => new Uint8Array(size))] as BufferStore;
  let mode: Modes | -1 = -1;

  const pull = async (controller: { enqueue(chunk: any): void; close(): void }) => {
    const { value, done } = await reader.read();
    const chunk = value;

    if (done) {
      const remainder = flush(buffers, mode);
      if (sizeOf(remainder) > 0) {
        controller.enqueue(remainder);
      }
      controller.close();
    } else {
      const chunkMode = modeOf(chunk);
      if (mode !== chunkMode) {
        if (mode >= 0) {
          controller.enqueue(flush(buffers, mode));
        }
        mode = chunkMode;
      }
      if (mode === -1) {
        controller.enqueue(chunk);
        return;
      }

      const chunkSize = sizeOf(chunk);
      bytesSeen += chunkSize;
      const bufferSize = sizeOf(buffers[mode]);
      if (chunkSize >= size && bufferSize === 0) {
        // skip writing to the intermediate buffer
        // because the upstream chunk is already large enough.
        controller.enqueue(chunk);
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
          controller.enqueue(flush(buffers, mode));
        } else {
          // repeat the pull because a call to pull must enqueue
          // something but this call did not enqueue anything.
          await pull(controller);
        }
      }
    }
  };

  return new ReadableStream({
    pull,
  });
}

/**
 * Replaces R/RS polymorphic implementation in environments with only ReadableStream.
 * @internal
 */
export const createBufferedReadable = createBufferedReadableStream;

/**
 * @internal
 * @param buffers
 * @param mode
 * @param chunk
 * @returns the new buffer size after merging the chunk with its appropriate buffer.
 */
export function merge(buffers: BufferStore, mode: Modes, chunk: string | Uint8Array): number {
  switch (mode) {
    case 0:
      buffers[0] += chunk;
      return sizeOf(buffers[0]);
    case 1:
    case 2:
      buffers[mode]!.push(chunk as Uint8Array);
      return sizeOf(buffers[mode]);
  }
}

/**
 * @internal
 * @param buffers
 * @param mode
 * @returns the buffer matching the mode.
 */
export function flush(buffers: BufferStore, mode: Modes | -1): BufferUnion {
  switch (mode) {
    case 0:
      const s = buffers[0];
      buffers[0] = "";
      return s;
    case 1:
    case 2:
      return buffers[mode]!.flush();
  }
  throw new Error(`@smithy/util-stream - invalid index ${mode} given to flush()`);
}

/**
 * @internal
 * @param chunk
 * @returns size of the chunk in bytes or characters.
 */
export function sizeOf(chunk?: { byteLength?: number; length?: number }): number {
  return (chunk as Uint8Array)?.byteLength ?? chunk?.length ?? 0;
}

/**
 * @internal
 * @param chunk - from upstream Readable.
 * @returns type index of the chunk.
 */
export function modeOf(chunk: BufferUnion): Modes | -1 {
  if (typeof Buffer !== "undefined" && chunk instanceof Buffer) {
    return 2;
  }
  if (chunk instanceof Uint8Array) {
    return 1;
  }
  if (typeof chunk === "string") {
    return 0;
  }
  return -1;
}
