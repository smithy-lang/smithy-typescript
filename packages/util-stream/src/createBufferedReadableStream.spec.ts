import { Readable } from "node:stream";
import { describe, expect, test as it, vi } from "vitest";

import { createBufferedReadableStream } from "./createBufferedReadableStream";

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
    const downstream = createBufferedReadableStream(midstream, 64);
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
    const downstream = createBufferedReadableStream(midstream, 49, logger);
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
});
