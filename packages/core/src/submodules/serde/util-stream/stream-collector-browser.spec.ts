import { describe, expect, test as it } from "vitest";

import { collectReadableStream, streamCollector } from "./stream-collector.browser";

describe("streamCollector (browser)", () => {
  it("collects a Blob into Uint8Array", async () => {
    const expected = new Uint8Array([102, 111, 111]);
    const blob = new Blob([expected]);
    const result = await streamCollector(blob);
    expect(result).toEqual(expected);
  });

  it("returns empty Uint8Array for empty Blob", async () => {
    const blob = new Blob([]);
    const result = await streamCollector(blob);
    expect(result).toEqual(new Uint8Array(0));
  });

  it("collects a ReadableStream into Uint8Array", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    const result = await streamCollector(stream);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("returns empty Uint8Array for empty ReadableStream", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    const result = await streamCollector(stream);
    expect(result).toEqual(new Uint8Array(0));
  });

  for (const collect of [collectReadableStream, streamCollector]) {
    describe(`${collect.name} reader cleanup`, () => {
      it.each([{ chunks: [] }, { chunks: [new Uint8Array([1, 2]), new Uint8Array([3, 4])] }])(
        "releases the reader after collecting $chunks.length chunks",
        async ({ chunks }) => {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              for (const chunk of chunks) {
                controller.enqueue(chunk);
              }
              controller.close();
            },
          });

          expect(await collect(stream)).toEqual(new Uint8Array(chunks.flatMap((chunk) => [...chunk])));
          expect(stream.locked).toBe(false);
          const reader = stream.getReader();
          try {
            expect(await reader.read()).toEqual({ done: true, value: undefined });
          } finally {
            reader.releaseLock();
          }
        }
      );

      it.each([false, true])("releases the reader after a read error (after chunk: %s)", async (afterChunk) => {
        const error = new Error("source read failed");
        let reads = 0;
        const stream = new ReadableStream<Uint8Array>({
          pull(controller) {
            if (afterChunk && reads++ === 0) {
              controller.enqueue(new Uint8Array([1, 2]));
            } else {
              controller.error(error);
            }
          },
        });

        await expect(collect(stream)).rejects.toBe(error);
        expect(stream.locked).toBe(false);
        const reader = stream.getReader();
        try {
          await expect(reader.read()).rejects.toBe(error);
        } finally {
          reader.releaseLock();
        }
      });
    });
  }
});
