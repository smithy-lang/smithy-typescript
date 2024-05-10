import { StreamCollector } from "@smithy/types";
import { Readable } from "stream";
import type { ReadableStream as IReadableStream } from "stream/web";

import { Collector } from "./collector";

export const streamCollector: StreamCollector = (stream: Readable | IReadableStream): Promise<Uint8Array> => {
  if (isReadableStreamInstance(stream)) {
    // Web stream API in Node.js
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

/**
 * Note: the global.ReadableStream object is marked experimental, and was added in v18.0.0 of Node.js.
 * The importable version was added in v16.5.0. We only test for the global version so as not to
 * enforce an import on a Node.js version that may not have it, and import
 * only the type from stream/web.
 */
const isReadableStreamInstance = (stream: unknown): stream is IReadableStream =>
  typeof ReadableStream === "function" && stream instanceof ReadableStream;

async function collectReadableStream(stream: IReadableStream): Promise<Uint8Array> {
  const chunks = [];
  const reader = stream.getReader();
  let isDone = false;
  let length = 0;

  while (!isDone) {
    const { done, value } = await reader.read();
    if (value) {
      chunks.push(value);
      length += value.length;
    }
    isDone = done;
  }

  const collected = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    collected.set(chunk, offset);
    offset += chunk.length;
  }

  return collected;
}
