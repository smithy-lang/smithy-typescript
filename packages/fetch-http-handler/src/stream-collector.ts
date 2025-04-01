import { StreamCollector } from "@smithy/types";
import { fromBase64 } from "@smithy/util-base64";

export const streamCollector: StreamCollector = async (stream: Blob | ReadableStream): Promise<Uint8Array> => {
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
      // reference: https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL
      // response from readAsDataURL is always prepended with "data:*/*;base64,"
      if (reader.readyState !== 2) {
        return reject(new Error("Reader aborted too early"));
      }
      const result = (reader.result ?? "") as string;
      // Response can include only 'data:' for empty blob, return empty string in this case.
      // Otherwise, return the string after ','
      const commaIndex = result.indexOf(",");
      const dataOffset = commaIndex > -1 ? commaIndex + 1 : result.length;
      resolve(result.substring(dataOffset));
    };
    reader.onabort = () => reject(new Error("Read aborted"));
    reader.onerror = () => reject(reader.error);
    // reader.readAsArrayBuffer is not always available
    reader.readAsDataURL(blob);
  });
}
