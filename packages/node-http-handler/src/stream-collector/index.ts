import { StreamCollector } from "@smithy/types";
import { Readable } from "stream";

import { Collector } from "./collector";

export const streamCollector: StreamCollector = (stream: Readable | ReadableStream): Promise<Uint8Array> => {
  if (isReadableStreamInstance(stream)) {
    // web stream in Node.js indicates user has overridden requestHandler with FetchHttpHandler.
    return collectReadableStream(stream);
  }
  return new Promise((resolve, reject) => {
    const collector = new Collector();
    stream.pipe(collector);
    stream.on("error", (err) => {
      // if the source errors, the destination stream needs to manually end
      collector.end();
      reject(err);
    });
    collector.on("error", reject);
    collector.on("finish", function (this: Collector) {
      const bytes = new Uint8Array(Buffer.concat(this.bufferedBytes));
      resolve(bytes);
    });
  });
};

const isReadableStreamInstance = (stream: unknown): stream is ReadableStream =>
  typeof ReadableStream === "function" && stream instanceof ReadableStream;

async function collectReadableStream(stream: ReadableStream): Promise<Uint8Array> {
  let res = new Uint8Array(0);
  const reader = stream.getReader();
  let isDone = false;
  while (!isDone) {
    const { done, value } = await reader.read();
    if (value) {
      const prior = res;
      res = new Uint8Array(prior.length + value.length);
      res.set(prior);
      res.set(value, prior.length);
    }
    isDone = done;
  }
  return res;
}
