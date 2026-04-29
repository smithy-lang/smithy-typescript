/**
 * @param stream
 * @returns stream split into two identical streams.
 */
export async function splitStream(stream: ReadableStream | Blob): Promise<[ReadableStream, ReadableStream]> {
  if (typeof (stream as Blob).stream === "function") {
    stream = (stream as Blob).stream();
  }
  const readableStream = stream as ReadableStream;
  return readableStream.tee();
}
