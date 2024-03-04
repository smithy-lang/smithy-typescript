import { StreamCollector } from "@smithy/types";

//reference: https://snack.expo.io/r1JCSWRGU
export const streamCollector: StreamCollector = (stream: Blob | ReadableStream): Promise<Uint8Array> => {
  if (typeof Blob === "function" && stream instanceof Blob) {
    return new Uint8Array(await stream.arrayBuffer());
  }

  return collectStream(stream as ReadableStream);
};

async function collectStream(stream: ReadableStream): Promise<Uint8Array> {
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
