import { Writable, type Readable } from "node:stream";
import type { ReadableStream as IReadableStream } from "node:stream/web";

/**
 * Inlined from @smithy/node-http-handler streamCollector.
 *
 * @internal
 */
class Collector extends Writable {
  public readonly bufferedBytes: Buffer[] = [];
  _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void) {
    this.bufferedBytes.push(chunk);
    callback();
  }
}

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

export const streamCollector = (stream: Readable | IReadableStream): Promise<Uint8Array> => {
  if (isReadableStreamInstance(stream)) {
    return collectReadableStream(stream);
  }
  return new Promise((resolve, reject) => {
    const collector = new Collector();
    stream.pipe(collector);
    stream.on("error", (err) => {
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
