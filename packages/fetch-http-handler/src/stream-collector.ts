import { StreamCollector } from "@smithy/types";

//reference: https://snack.expo.io/r1JCSWRGU
export const streamCollector: StreamCollector = async (stream: Blob | ReadableStream): Promise<Uint8Array> => {
  if (typeof Blob === "function" && stream instanceof Blob) {
    return new Uint8Array(await stream.arrayBuffer());
  }

  return collectStream(stream as ReadableStream);
};

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
