import type { SdkStream, SdkStreamMixin } from "@smithy/types";
import { fromArrayBuffer } from "@smithy/util-buffer-from";
import type { ReadableStream as IReadableStream } from "node:stream/web";
import { Readable, Writable } from "stream";

import { sdkStreamMixin as sdkStreamMixinReadableStream } from "./sdk-stream-mixin.browser";

/**
 * @internal
 * Inlined from @smithy/node-http-handler.
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

const streamCollector = (stream: Readable | IReadableStream): Promise<Uint8Array> => {
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

const ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED = "The stream has already been transformed.";

/**
 * The function that mixes in the utility functions to help consuming runtime-specific payload stream.
 *
 * @internal
 */
export const sdkStreamMixin = (stream: unknown): SdkStream<ReadableStream | Blob> | SdkStream<Readable> => {
  if (!(stream instanceof Readable)) {
    try {
      /**
       * If the stream is not node:stream::Readable, it may be a web stream within Node.js.
       */
      return sdkStreamMixinReadableStream(stream);
    } catch (e: unknown) {
      // @ts-ignore
      const name = stream?.__proto__?.constructor?.name || stream;
      throw new Error(`Unexpected stream implementation, expect Stream.Readable instance, got ${name}`);
    }
  }

  let transformed = false;
  const transformToByteArray = async () => {
    if (transformed) {
      throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
    }
    transformed = true;
    return await streamCollector(stream);
  };

  return Object.assign<Readable, SdkStreamMixin>(stream, {
    transformToByteArray,
    transformToString: async (encoding?: string) => {
      const buf = await transformToByteArray();
      if (encoding === undefined || Buffer.isEncoding(encoding)) {
        return fromArrayBuffer(buf.buffer, buf.byteOffset, buf.byteLength).toString(encoding as BufferEncoding);
      } else {
        const decoder = new TextDecoder(encoding);
        return decoder.decode(buf);
      }
    },
    transformToWebStream: () => {
      if (transformed) {
        throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
      }
      if (stream.readableFlowing !== null) {
        // Prevent side effect of consuming webstream.
        throw new Error("The stream has been consumed by other callbacks.");
      }
      if (typeof Readable.toWeb !== "function") {
        throw new Error("Readable.toWeb() is not supported. Please ensure a polyfill is available.");
      }
      transformed = true;
      return Readable.toWeb(stream) as ReadableStream;
    },
  });
};
