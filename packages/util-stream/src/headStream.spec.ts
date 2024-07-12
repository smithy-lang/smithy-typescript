import { Readable } from "stream";

import { headStream } from "./headStream";
import { headStream as headWebStream } from "./headStream.browser";
import { splitStream } from "./splitStream";
import { splitStream as splitWebStream } from "./splitStream.browser";

const CHUNK_SIZE = 4;
const a32 = "abcd".repeat(32_000 / CHUNK_SIZE);
const a16 = "abcd".repeat(16_000 / CHUNK_SIZE);
const a8 = "abcd".repeat(8);
const a4 = "abcd".repeat(4);
const a2 = "abcd".repeat(2);
const a1 = "abcd".repeat(1);

describe(headStream.name, () => {
  it("should collect the head of a Node.js stream", async () => {
    const data = Buffer.from(a32);
    const myStream = Readable.from(data);

    const head = await headStream(myStream, 16_000);

    expect(Buffer.from(head).toString()).toEqual(a16);
  });

  it("should collect the head of a web stream", async () => {
    if (typeof ReadableStream !== "undefined") {
      const buffer = Buffer.from(a32);
      const data = Array.from(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));

      const myStream = new ReadableStream({
        start(controller) {
          for (const inputChunk of data) {
            controller.enqueue(new Uint8Array([inputChunk]));
          }
          controller.close();
        },
      });

      const head = await headWebStream(myStream, 16_000);
      expect(Buffer.from(head).toString()).toEqual(a16);
    }
  });
});

describe("splitStream and headStream integration", () => {
  it("should split and head streams for Node.js", async () => {
    const data = Buffer.from(a32);
    const myStream = Readable.from(data);

    const [a, _1] = await splitStream(myStream);
    const [b, _2] = await splitStream(_1);
    const [c, _3] = await splitStream(_2);
    const [d, _4] = await splitStream(_3);
    const [e, f] = await splitStream(_4);

    const buffer1 = await headStream(a, Infinity);
    const buffer2 = await headStream(b, 16_000);
    const buffer3 = await headStream(c, 8 * CHUNK_SIZE);
    const buffer4 = await headStream(d, 4 * CHUNK_SIZE);
    const buffer5 = await headStream(e, 2 * CHUNK_SIZE);
    const buffer6 = await headStream(f, CHUNK_SIZE);

    await Promise.all([a, b, c, d, e, f].map((stream) => stream.destroy()));

    expect(Buffer.from(buffer1).toString()).toEqual(a32);
    expect(Buffer.from(buffer2).toString()).toEqual(a16);
    expect(Buffer.from(buffer3).toString()).toEqual(a8);
    expect(Buffer.from(buffer4).toString()).toEqual(a4);
    expect(Buffer.from(buffer5).toString()).toEqual(a2);
    expect(Buffer.from(buffer6).toString()).toEqual(a1);
  });

  it("should split and head streams for web streams API", async () => {
    if (typeof ReadableStream !== "undefined") {
      const buffer = Buffer.from(a8);
      const data = Array.from(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));

      const myStream = new ReadableStream({
        start(controller) {
          for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            controller.enqueue(new Uint8Array(data.slice(i, i + CHUNK_SIZE)));
          }
          controller.close();
        },
      });

      const [a, _1] = await splitWebStream(myStream);
      const [b, _2] = await splitWebStream(_1);
      const [c, _3] = await splitWebStream(_2);
      const [d, e] = await splitWebStream(_3);

      const buffer1 = await headWebStream(a, Infinity);
      const buffer2 = await headWebStream(b, 8 * CHUNK_SIZE);
      const buffer3 = await headWebStream(c, 4 * CHUNK_SIZE);
      const buffer4 = await headWebStream(d, 2 * CHUNK_SIZE);
      const buffer5 = await headWebStream(e, CHUNK_SIZE);

      await Promise.all([a, b, c, d, e].map((stream) => stream.cancel()));

      expect(Buffer.from(buffer1).toString()).toEqual(a8);
      expect(Buffer.from(buffer2).toString()).toEqual(a8);
      expect(Buffer.from(buffer3).toString()).toEqual(a4);
      expect(Buffer.from(buffer4).toString()).toEqual(a2);
      expect(Buffer.from(buffer5).toString()).toEqual(a1);
    }
  });
});
