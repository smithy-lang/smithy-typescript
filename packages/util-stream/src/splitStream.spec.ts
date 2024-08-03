import { streamCollector as webStreamCollector } from "@smithy/fetch-http-handler";
import { streamCollector } from "@smithy/node-http-handler";
import { Readable } from "stream";

import { splitStream } from "./splitStream";
import { splitStream as splitWebStream } from "./splitStream.browser";

describe(splitStream.name, () => {
  it("should split a node:Readable stream", async () => {
    const data = Buffer.from("abcd");

    const myStream = Readable.from(data);
    const [a, b] = await splitStream(myStream);

    const buffer1 = await streamCollector(a);
    const buffer2 = await streamCollector(b);

    expect(buffer1).toEqual(new Uint8Array([97, 98, 99, 100]));
    expect(buffer1).toEqual(buffer2);
  });
  it("should split a web:ReadableStream stream", async () => {
    if (typeof ReadableStream !== "undefined") {
      const inputChunks = [97, 98, 99, 100];

      const myStream = new ReadableStream({
        start(controller) {
          for (const inputChunk of inputChunks) {
            controller.enqueue(new Uint8Array([inputChunk]));
          }
          controller.close();
        },
      });

      const [a, b] = await splitWebStream(myStream);

      const bytes1 = await webStreamCollector(a);
      const bytes2 = await webStreamCollector(b);

      expect(bytes1).toEqual(new Uint8Array([97, 98, 99, 100]));
      expect(bytes1).toEqual(bytes2);
    }
  });
});
