import { Writable, type Readable } from "node:stream";
import type { ReadableStream as IReadableStream } from "node:stream/web";

import { concatBytes } from "../concatBytes";
import { collectBlob, collectReadableStream } from "./stream-collector.browser";
import { isBlob, isReadableStream } from "./stream-type-check";

/**
 * @internal
 */
export const streamCollector = (stream: Readable | IReadableStream | ReadableStream | Blob): Promise<Uint8Array> => {
  if (isBlob(stream)) {
    return collectBlob(stream);
  }
  if (isReadableStream(stream)) {
    return collectReadableStream(stream);
  }
  return new Promise((resolve, reject) => {
    const collector = new Collector();
    const nodeStream = stream as Readable;
    nodeStream.pipe(collector);
    nodeStream.on("error", (err: Error) => {
      collector.end();
      reject(err);
    });
    collector.on("error", reject);
    collector.on("finish", function (this: Collector) {
      const bytes = concatBytes(this.bufferedBytes);
      resolve(bytes);
    });
  });
};

/**
 * @internal
 */
class Collector extends Writable {
  public readonly bufferedBytes: Buffer[] = [];
  _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void) {
    this.bufferedBytes.push(chunk);
    callback();
  }
}
