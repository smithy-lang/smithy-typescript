import { Readable } from "node:stream";
import { describe, expect, test as it, vi } from "vitest";

import { createBufferedReadable } from "./createBufferedReadable";
import { headStream } from "./headStream";

describe("Buffered Readable stream", () => {
  function stringStream(size: number, chunkSize: number) {
    async function* generate() {
      while (size > 0) {
        yield "a".repeat(chunkSize);
        size -= chunkSize;
      }
    }
    return Readable.from(generate());
  }
  function byteStream(size: number, chunkSize: number) {
    async function* generate() {
      while (size > 0) {
        yield Buffer.from(new Uint8Array(chunkSize));
        size -= chunkSize;
      }
    }
    return Readable.from(generate());
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
      stream: Readable.from(size === 0 ? Buffer.from("") : generate()),
      array: new Uint8Array(data),
    };
  }

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error() {},
  };

  const KB = 1024;

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

  for (const [dataSize, chunkSize, bufferSize] of [
    [10 * KB, 1 * KB, 0 * KB],
    [10 * KB, 1 * KB, 1 * KB],
    [10 * KB, 1 * KB, 2.1 * KB],
    [10 * KB, 1 * KB, 4 * KB],
    [10 * KB, 2 * KB, 1 * KB],
  ]) {
    it(`should maintain data integrity for data=${dataSize} chunk=${chunkSize} min-buffer=${bufferSize}`, async () => {
      const { stream, array } = patternedByteStream(dataSize, chunkSize);
      const bufferedStream = createBufferedReadable(stream, bufferSize);
      const collected = await headStream(bufferedStream, Infinity);
      expect(collected).toEqual(array);
    });
  }

  it("should join upstream chunks if they are too small (stringStream)", async () => {
    const upstream = stringStream(1024, 8);
    const downstream = createBufferedReadable(upstream, 64);

    let upstreamChunkCount = 0;
    upstream.on("data", () => {
      upstreamChunkCount += 1;
    });

    let downstreamChunkCount = 0;
    downstream.on("data", () => {
      downstreamChunkCount += 1;
    });

    await headStream(downstream, Infinity);

    expect(upstreamChunkCount).toEqual(128);
    expect(downstreamChunkCount).toEqual(16);
  });

  it("should join upstream chunks if they are too small (byteStream)", async () => {
    const upstream = byteStream(1031, 7);
    const downstream = createBufferedReadable(upstream, 49, logger);

    let upstreamChunkCount = 0;
    upstream.on("data", () => {
      upstreamChunkCount += 1;
    });

    let downstreamChunkCount = 0;
    downstream.on("data", () => {
      downstreamChunkCount += 1;
    });

    await headStream(downstream, Infinity);

    expect(Math.ceil(1031 / 7)).toBe(148);
    expect(Math.ceil(1031 / 49)).toBe(22);

    expect(upstreamChunkCount).toEqual(148);
    expect(downstreamChunkCount).toEqual(22);
    expect(logger.warn).toHaveBeenCalled();
  });
}, 30_000);
