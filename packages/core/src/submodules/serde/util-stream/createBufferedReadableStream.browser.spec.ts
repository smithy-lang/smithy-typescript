import { Readable } from "node:stream";
import { describe, expect, test as it, vi } from "vitest";

import { createBufferedReadable } from "./createBufferedReadableStream";
import { headStream } from "./headStream.browser";

describe("Buffered ReadableStream", () => {
  function stringStream(size: number, chunkSize: number) {
    async function* generate() {
      while (size > 0) {
        yield "a".repeat(chunkSize);
        size -= chunkSize;
      }
    }
    return Readable.toWeb(Readable.from(generate()));
  }
  function byteStream(size: number, chunkSize: number) {
    async function* generate() {
      while (size > 0) {
        yield new Uint8Array(chunkSize);
        size -= chunkSize;
      }
    }
    return Readable.toWeb(Readable.from(generate()));
  }
  function patternedByteStream(size: number, chunkSize: number) {
    let n = 0;
    const data = Array(size);
    for (let i = 0; i < size; ++i) {
      data[i] = n++ % 255;
    }
    let dataCursor = 0;

    async function* generate() {
      while (size > 0) {
        const z = Math.min(size, chunkSize);
        const bytes = new Uint8Array(data.slice(dataCursor, dataCursor + z));
        size -= z;
        dataCursor += z;
        yield bytes;
      }
    }
    return {
      stream: Readable.toWeb(Readable.from(size === 0 ? Buffer.from("") : generate())) as unknown as ReadableStream,
      array: new Uint8Array(data),
    };
  }
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error() {},
  };

  it("should join upstream chunks if they are too small (stringStream)", async () => {
    let upstreamChunkCount = 0;
    let downstreamChunkCount = 0;

    const upstream = stringStream(1024, 8);
    const upstreamReader = upstream.getReader();

    const midstream = new ReadableStream({
      async pull(controller) {
        const { value, done } = await upstreamReader.read();
        if (done) {
          controller.close();
        } else {
          expect(value.length).toBe(8);
          upstreamChunkCount += 1;
          controller.enqueue(value);
        }
      },
    });
    const downstream = createBufferedReadable(midstream, 64);
    const reader = downstream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      } else {
        downstreamChunkCount += 1;
        expect(value.length).toBe(64);
      }
    }

    expect(upstreamChunkCount).toEqual(128);
    expect(downstreamChunkCount).toEqual(16);
  });

  it("should join upstream chunks if they are too small (byteStream)", async () => {
    let upstreamChunkCount = 0;
    let downstreamChunkCount = 0;

    const upstream = byteStream(1031, 7);
    const upstreamReader = upstream.getReader();

    const midstream = new ReadableStream({
      async pull(controller) {
        const { value, done } = await upstreamReader.read();
        if (done) {
          controller.close();
        } else {
          expect(value.length).toBe(7);
          upstreamChunkCount += 1;
          controller.enqueue(value);
        }
      },
    });
    const downstream = createBufferedReadable(midstream, 49, logger);
    const downstreamReader = downstream.getReader();

    while (true) {
      const { done, value } = await downstreamReader.read();
      if (done) {
        break;
      } else {
        downstreamChunkCount += 1;
        if (value.byteLength > 7) {
          expect(value.byteLength).toBe(49);
        }
      }
    }

    expect(upstreamChunkCount).toEqual(148);
    expect(downstreamChunkCount).toEqual(22);
    expect(logger.warn).toHaveBeenCalled();
  });

  const dataSizes = [0, 10, 101, 1_001, 10_001, 100_001];
  const chunkSizes = [1, 8, 16, 32, 64, 128, 1024, 8 * 1024, 64 * 1024, 1024 * 1024];
  const bufferSizes = [0, 1024, 8 * 1024, 32 * 1024, 64 * 1024, 1024 * 1024];

  for (const dataSize of dataSizes) {
    for (const chunkSize of chunkSizes) {
      for (const bufferSize of bufferSizes) {
        it(`should maintain data integrity for data=${dataSize} chunk=${chunkSize} min-buffer=${bufferSize}`, async () => {
          const { stream, array } = patternedByteStream(dataSize, chunkSize);
          const bufferedStream = createBufferedReadable(stream, bufferSize);
          const collected = await headStream(bufferedStream, Infinity);
          expect(collected).toEqual(array);
        });
      }
    }
  }
});
