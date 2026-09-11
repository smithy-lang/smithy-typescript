import { Readable } from "node:stream";
import type { GetAwsChunkedEncodingStreamOptions } from "@smithy/types";

import { getAwsChunkedEncodingStream as getAwsChunkedEncodingStreamBrowser } from "./getAwsChunkedEncodingStream.browser";
import { isReadableStream } from "./stream-type-check";

/**
 * @internal
 */
export function getAwsChunkedEncodingStream(stream: Readable, options: GetAwsChunkedEncodingStreamOptions): Readable;
/**
 * @internal
 */
export function getAwsChunkedEncodingStream(
  stream: ReadableStream,
  options: GetAwsChunkedEncodingStreamOptions
): ReadableStream;
/**
 * @internal
 */
export function getAwsChunkedEncodingStream(
  stream: Readable | ReadableStream,
  options: GetAwsChunkedEncodingStreamOptions
): Readable | ReadableStream {
  const readable = stream as Readable;
  const readableStream = stream as ReadableStream;
  if (isReadableStream(readableStream)) {
    return getAwsChunkedEncodingStreamBrowser(readableStream, options);
  }
  const { base64Encoder, bodyLengthChecker, checksumAlgorithmFn, checksumLocationName, streamHasher } = options;

  const checksumRequired =
    base64Encoder !== undefined &&
    checksumAlgorithmFn !== undefined &&
    checksumLocationName !== undefined &&
    streamHasher !== undefined;
  const digest = checksumRequired ? streamHasher!(checksumAlgorithmFn!, readable) : undefined;

  Promise.resolve(digest).catch(() => {
    // Block unhandled rejection; the original promise is awaited later.
  });

  // Pull-driven, so the encoder respects consumer demand.
  const awsChunkedEncodingStream = new Readable({
    read() {
      readable.resume();
    },
  });
  readable.on("data", (data) => {
    const length = bodyLengthChecker(data) || 0;
    if (length === 0) {
      return;
    }
    awsChunkedEncodingStream.push(`${length.toString(16)}\r\n`);
    awsChunkedEncodingStream.push(data);
    if (!awsChunkedEncodingStream.push("\r\n")) {
      readable.pause();
    }
  });
  // Forward source errors so consumers see "error" instead of hanging.
  readable.on("error", (err) => {
    awsChunkedEncodingStream.destroy(err);
  });
  // Attaching "data" flowed the source; pause until the first read.
  readable.pause();
  readable.on("end", async () => {
    try {
      awsChunkedEncodingStream.push(`0\r\n`);
      if (checksumRequired) {
        const checksum = base64Encoder!(await digest!);
        awsChunkedEncodingStream.push(`${checksumLocationName}:${checksum}\r\n`);
        awsChunkedEncodingStream.push(`\r\n`);
      }
      awsChunkedEncodingStream.push(null);
    } catch (err) {
      // Digest rejected after a clean end: fail the stream, don't leak.
      awsChunkedEncodingStream.destroy(err as Error);
    }
  });
  return awsChunkedEncodingStream;
}
