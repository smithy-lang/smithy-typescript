import { Readable, type ReadableOptions } from "node:stream";
import { describe, expect, test as it } from "vitest";

import { streamCollector } from "./stream-collector";

class ReadFromBuffers extends Readable {
  private buffersToRead: Buffer[];
  private numBuffersRead = 0;
  private errorAfter: number;

  constructor(options: ReadableOptions & { buffers: Buffer[]; errorAfter?: number }) {
    super(options);
    this.buffersToRead = options.buffers;
    this.errorAfter = typeof options.errorAfter === "number" ? options.errorAfter : -1;
  }

  _read() {
    if (this.errorAfter !== -1 && this.errorAfter === this.numBuffersRead) {
      this.emit("error", new Error("Mock Error"));
      return;
    }
    if (this.numBuffersRead >= this.buffersToRead.length) {
      return this.push(null);
    }
    return this.push(this.buffersToRead[this.numBuffersRead++]);
  }
}

describe("streamCollector (Node)", () => {
  it("returns a Uint8Array containing all data from a stream", async () => {
    const mockReadStream = new ReadFromBuffers({
      buffers: [Buffer.from("foo"), Buffer.from("bar"), Buffer.from("buzz")],
    });
    const result = await streamCollector(mockReadStream);
    expect(result).toEqual(new Uint8Array([102, 111, 111, 98, 97, 114, 98, 117, 122, 122]));
  });

  it("returns empty Uint8Array for empty stream", async () => {
    const stream = new ReadFromBuffers({ buffers: [] });
    const result = await streamCollector(stream);
    expect(result).toEqual(new Uint8Array(0));
  });

  it("propagates errors from the stream", async () => {
    const stream = new ReadFromBuffers({ buffers: [], errorAfter: 0 });
    await expect(streamCollector(stream)).rejects.toThrow("Mock Error");
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

  it("collects a Blob into Uint8Array", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])]);
    const result = await streamCollector(blob);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("returns empty Uint8Array for empty Blob", async () => {
    const blob = new Blob([]);
    const result = await streamCollector(blob);
    expect(result).toEqual(new Uint8Array(0));
  });
});
