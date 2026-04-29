import { describe, expect, test as it } from "vitest";

import { streamCollector } from "./stream-collector";

describe("streamCollector", () => {
  const blobAvailable = typeof Blob === "function";
  const readableStreamAvailable = typeof ReadableStream === "function";

  (blobAvailable ? it : it.skip)("collects Blob into bytearray", async () => {
    const blobby = new Blob([new Uint8Array([1, 2]), new Uint8Array([3, 4])]);
    const collected = await streamCollector(blobby);
    expect(collected).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  (readableStreamAvailable ? it : it.skip)("collects ReadableStream into bytearray", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    const collected = await streamCollector(stream);
    expect(collected).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});
