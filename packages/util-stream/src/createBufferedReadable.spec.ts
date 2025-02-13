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
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error() {},
  };

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
});
