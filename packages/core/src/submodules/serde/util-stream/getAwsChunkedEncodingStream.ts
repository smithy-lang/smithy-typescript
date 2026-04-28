import type { GetAwsChunkedEncodingStreamOptions } from "@smithy/types";
import { Readable } from "node:stream";

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

  const awsChunkedEncodingStream = new Readable({
    read: () => {},
  });
  readable.on("data", (data) => {
    const length = bodyLengthChecker(data) || 0;
    if (length === 0) {
      return;
    }
    awsChunkedEncodingStream.push(`${length.toString(16)}\r\n`);
    awsChunkedEncodingStream.push(data);
    awsChunkedEncodingStream.push("\r\n");
  });
  readable.on("end", async () => {
    awsChunkedEncodingStream.push(`0\r\n`);
    if (checksumRequired) {
      const checksum = base64Encoder!(await digest!);
      awsChunkedEncodingStream.push(`${checksumLocationName}:${checksum}\r\n`);
      awsChunkedEncodingStream.push(`\r\n`);
    }
    awsChunkedEncodingStream.push(null);
  });
  return awsChunkedEncodingStream;
}
