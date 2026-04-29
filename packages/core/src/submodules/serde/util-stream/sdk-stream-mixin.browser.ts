import type { SdkStream, SdkStreamMixin } from "@smithy/types";

import { fromBase64 } from "../util-base64/fromBase64";
import { toBase64 } from "../util-base64/toBase64";
import { toHex } from "../util-hex-encoding/hex-encoding";
import { toUtf8 } from "../util-utf8/toUtf8";
import { isReadableStream } from "./stream-type-check";

/**
 * @internal
 * Inlined from @smithy/fetch-http-handler streamCollector.
 */
const streamCollector = async (stream: Blob | ReadableStream): Promise<Uint8Array> => {
  if ((typeof Blob === "function" && stream instanceof Blob) || stream.constructor?.name === "Blob") {
    if (Blob.prototype.arrayBuffer !== undefined) {
      return new Uint8Array(await (stream as Blob).arrayBuffer());
    }
    return collectBlob(stream as Blob);
  }
  return collectStream(stream as ReadableStream);
};

async function collectBlob(blob: Blob): Promise<Uint8Array> {
  const base64 = await readToBase64(blob);
  const arrayBuffer = fromBase64(base64);
  return new Uint8Array(arrayBuffer);
}

async function collectStream(stream: ReadableStream): Promise<Uint8Array> {
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

function readToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.readyState !== 2) {
        return reject(new Error("Reader aborted too early"));
      }
      const result = (reader.result ?? "") as string;
      const commaIndex = result.indexOf(",");
      const dataOffset = commaIndex > -1 ? commaIndex + 1 : result.length;
      resolve(result.substring(dataOffset));
    };
    reader.onabort = () => reject(new Error("Read aborted"));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED = "The stream has already been transformed.";

/**
 * The stream handling utility functions for browsers and React Native
 *
 * @internal
 */
export const sdkStreamMixin = (stream: unknown): SdkStream<ReadableStream | Blob> => {
  if (!isBlobInstance(stream) && !isReadableStream(stream)) {
    //@ts-ignore
    const name = stream?.__proto__?.constructor?.name || stream;
    throw new Error(`Unexpected stream implementation, expect Blob or ReadableStream, got ${name}`);
  }

  let transformed = false;
  const transformToByteArray = async () => {
    if (transformed) {
      throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
    }
    transformed = true;
    return await streamCollector(stream);
  };

  const blobToWebStream = (blob: Blob) => {
    if (typeof blob.stream !== "function") {
      throw new Error(
        "Cannot transform payload Blob to web stream. Please make sure the Blob.stream() is polyfilled.\n" +
          "If you are using React Native, this API is not yet supported, see: https://react-native.canny.io/feature-requests/p/fetch-streaming-body"
      );
    }
    return blob.stream();
  };

  return Object.assign<ReadableStream | Blob, SdkStreamMixin>(stream, {
    transformToByteArray: transformToByteArray,

    transformToString: async (encoding?: string) => {
      const buf = await transformToByteArray();
      if (encoding === "base64") {
        return toBase64(buf);
      } else if (encoding === "hex") {
        return toHex(buf);
      } else if (encoding === undefined || encoding === "utf8" || encoding === "utf-8") {
        // toUtf8() itself will use TextDecoder and fallback to pure JS implementation.
        return toUtf8(buf);
      } else if (typeof TextDecoder === "function") {
        return new TextDecoder(encoding).decode(buf);
      } else {
        throw new Error("TextDecoder is not available, please make sure polyfill is provided.");
      }
    },

    transformToWebStream: () => {
      if (transformed) {
        throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
      }
      transformed = true;
      if (isBlobInstance(stream)) {
        // ReadableStream is undefined in React Native
        return blobToWebStream(stream);
      } else if (isReadableStream(stream)) {
        return stream;
      } else {
        throw new Error(`Cannot transform payload to web stream, got ${stream}`);
      }
    },
  });
};

const isBlobInstance = (stream: unknown): stream is Blob => typeof Blob === "function" && stream instanceof Blob;
