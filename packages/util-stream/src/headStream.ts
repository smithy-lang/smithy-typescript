import type { Readable } from "stream";
import { Writable } from "stream";

import { headStream as headWebStream } from "./headStream.browser";
import { isReadableStream } from "./stream-type-check";

/**
 * @internal
 * @param stream - to be read.
 * @param bytes - read head bytes from the stream and discard the rest of it.
 *
 * Caution: the input stream must be destroyed separately, this function does not do so.
 */
export const headStream = (stream: Readable | ReadableStream, bytes: number): Promise<Uint8Array> => {
  if (isReadableStream(stream)) {
    return headWebStream(stream, bytes);
  }
  return new Promise((resolve, reject) => {
    const collector = new Collector();
    collector.limit = bytes;
    stream.pipe(collector);
    stream.on("error", (err) => {
      collector.end();
      reject(err);
    });
    collector.on("error", reject);
    collector.on("finish", function (this: Collector) {
      const bytes = new Uint8Array(Buffer.concat(this.buffers));
      resolve(bytes);
    });
  });
};

class Collector extends Writable {
  public readonly buffers: Buffer[] = [];
  public limit = Infinity;
  private bytesBuffered = 0;

  _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void) {
    this.buffers.push(chunk);
    this.bytesBuffered += chunk.byteLength ?? 0;
    if (this.bytesBuffered >= this.limit) {
      const excess = this.bytesBuffered - this.limit;
      const tailBuffer = this.buffers[this.buffers.length - 1];
      this.buffers[this.buffers.length - 1] = tailBuffer.subarray(0, tailBuffer.byteLength - excess);
      this.emit("finish");
    }
    callback();
  }
}
