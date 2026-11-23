import type { GetAwsChunkedEncodingStream, GetAwsChunkedEncodingStreamOptions } from "@smithy/types";

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

  Promise.resolve(digest).catch(() => {
    // Block unhandled rejection; the original promise is awaited later.
  });

  // ToDo: Validate the ReadableStream and getReader() is accessible before calling.
  // ReactNative doesn't support ReadableStream. They might not be available in older browsers, or some polyfills.
  const reader = readableStream.getReader();
  let cancelled = false;
  let readerReleased = false;
  const releaseReader = () => {
    if (!readerReleased) {
      reader.releaseLock();
      readerReleased = true;
    }
  };
  const cancelReader = async (reason?: unknown) => {
    if (!readerReleased) {
      try {
        await reader.cancel(reason);
      } finally {
        releaseReader();
      }
    }
  };
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (cancelled) {
          return;
        }

        if (done) {
          releaseReader();
          controller.enqueue(`0\r\n`);
          if (checksumRequired) {
            const checksumBytes = await digest!;
            if (cancelled) {
              return;
            }
            const checksum = base64Encoder!(checksumBytes);
            controller.enqueue(`${checksumLocationName}:${checksum}\r\n`);
            controller.enqueue(`\r\n`);
          }
          controller.close();
        } else {
          controller.enqueue(`${(bodyLengthChecker(value) || 0).toString(16)}\r\n${value}\r\n`);
        }
      } catch (error) {
        try {
          await cancelReader(error);
        } catch {
          // Preserve the original error if source cleanup also fails.
        }
        throw error;
      }
    },
    cancel(reason) {
      cancelled = true;
      return cancelReader(reason);
    },
  });
};
