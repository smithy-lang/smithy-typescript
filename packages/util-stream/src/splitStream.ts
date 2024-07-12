import type { Readable as IReadable } from "stream";
import { PassThrough } from "stream";

/**
 * @param stream
 * @returns stream split into two identical streams.
 */
export async function splitStream(stream: IReadable): Promise<[IReadable, IReadable]> {
  const stream1 = new PassThrough();
  const stream2 = new PassThrough();
  stream.pipe(stream1);
  stream.pipe(stream2);
  return [stream1, stream2];
}
