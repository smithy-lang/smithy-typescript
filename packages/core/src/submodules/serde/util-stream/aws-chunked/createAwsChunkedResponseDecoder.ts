import type { Readable } from "node:stream";

import { isReadableStream } from "../stream-type-check";
import { AwsChunkedDecodingStream } from "./AwsChunkedDecodingStream";
import {
  createAwsChunkedResponseDecoder as createAwsChunkedResponseDecoderWeb,
  type ReadableStreamType,
} from "./createAwsChunkedResponseDecoder.browser";
import type { AwsChunkedResponseDecoderOptions, AwsChunkedResponseDecoderResult, TrailerField } from "./types";

/**
 * Removes `aws-chunked` framing from a response body, returning the decoded
 * payload and the ordered trailer section that followed it.
 *
 * Decoding is driven by the response's content encoding rather than by whether
 * a checksum is being validated, so an encoded body is decoded even when no
 * checksum is selected.
 *
 * @internal
 */
export function createAwsChunkedResponseDecoder(
  options: AwsChunkedResponseDecoderOptions<ReadableStreamType>
): AwsChunkedResponseDecoderResult<ReadableStreamType>;
/**
 * @internal
 */
export function createAwsChunkedResponseDecoder(
  options: AwsChunkedResponseDecoderOptions<Readable>
): AwsChunkedResponseDecoderResult<Readable>;
/**
 * @internal
 */
export function createAwsChunkedResponseDecoder(
  options: AwsChunkedResponseDecoderOptions<Readable | ReadableStreamType>
): AwsChunkedResponseDecoderResult<Readable | ReadableStreamType> {
  if (typeof ReadableStream === "function" && isReadableStream(options.source)) {
    return createAwsChunkedResponseDecoderWeb(options as AwsChunkedResponseDecoderOptions<ReadableStreamType>);
  }

  const { source, declaredTrailers, decodedContentLength } = options as AwsChunkedResponseDecoderOptions<Readable>;

  let resolveTrailers!: (trailers: readonly TrailerField[]) => void;
  let rejectTrailers!: (error: Error) => void;
  const trailers = new Promise<readonly TrailerField[]>((resolve, reject) => {
    resolveTrailers = resolve;
    rejectTrailers = reject;
  });
  // Mark the promise as handled so a caller that never reads it, such as one
  // that selected a stored checksum instead, does not raise an unhandled
  // rejection. Real awaiters still observe the rejection.
  trailers.catch(() => {});

  const body = new AwsChunkedDecodingStream({
    source,
    declaredTrailers,
    decodedContentLength,
    onTrailers: resolveTrailers,
    onError: rejectTrailers,
  });

  return { body, trailers };
}
