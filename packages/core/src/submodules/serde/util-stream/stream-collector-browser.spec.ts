import { describe, expect, test as it } from "vitest";

import { streamCollector } from "./stream-collector.browser";

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
});
