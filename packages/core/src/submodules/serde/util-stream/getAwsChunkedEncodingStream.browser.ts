import type { GetAwsChunkedEncodingStream, GetAwsChunkedEncodingStreamOptions } from "@smithy/types";

import { fromUtf8 } from "../util-utf8/fromUtf8.browser";

const CRLF = "\r\n";

/**
 * @internal
 */
export const getAwsChunkedEncodingStream: GetAwsChunkedEncodingStream<ReadableStream> = (
  readableStream: ReadableStream,
  options: GetAwsChunkedEncodingStreamOptions
) => {
  const { base64Encoder, bodyLengthChecker, checksumAlgorithmFn, checksumLocationName, streamHasher } = options;

  const checksumRequired =
    base64Encoder !== undefined &&
    bodyLengthChecker !== undefined &&
    checksumAlgorithmFn !== undefined &&
    checksumLocationName !== undefined &&
    streamHasher !== undefined;
  const digest = checksumRequired ? streamHasher!(checksumAlgorithmFn!, readableStream) : undefined;

  // ToDo: Validate the ReadableStream and getReader() is accessible before calling.
  // ReactNative doesn't support ReadableStream. They might not be available in older browsers, or some polyfills.
  const reader = readableStream.getReader();
  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          controller.enqueue(fromUtf8(`0${CRLF}`));
          if (checksumRequired) {
            const checksum = base64Encoder!(await digest!);
            controller.enqueue(fromUtf8(`${checksumLocationName}:${checksum}${CRLF}`));
          }
          // The trailer section is always terminated by a blank line, whether or
          // not it carried any trailers. Without it the framing is incomplete.
          controller.enqueue(fromUtf8(CRLF));
          controller.close();
          return;
        }

        const length = bodyLengthChecker(value) || 0;
        if (length === 0) {
          // A zero-length chunk is framed identically to the terminal chunk and
          // would end the stream early, so it is skipped and the source is read
          // again. This matches the Node.js implementation.
          continue;
        }

        // Chunks are enqueued as bytes rather than interpolated into a string.
        // Interpolating a byte array yields its comma-separated decimal
        // digits, which corrupts the payload, and a request body stream must
        // yield BufferSource chunks in any case.
        controller.enqueue(fromUtf8(`${length.toString(16)}${CRLF}`));
        controller.enqueue(typeof value === "string" ? fromUtf8(value) : value);
        controller.enqueue(fromUtf8(CRLF));
        return;
      }
    },
  });
};
