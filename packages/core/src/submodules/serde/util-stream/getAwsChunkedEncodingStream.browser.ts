import type { Checksum, GetAwsChunkedEncodingStream, GetAwsChunkedEncodingStreamOptions, Hash } from "@smithy/types";

// fetch requires Uint8Array chunks in a ReadableStream request body.
const toBytes = (chunk: unknown, encoder: TextEncoder): Uint8Array => {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }
  if (typeof chunk === "string") {
    return encoder.encode(chunk);
  }
  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  if (chunk instanceof ArrayBuffer || Object.prototype.toString.call(chunk) === "[object ArrayBuffer]") {
    return new Uint8Array(chunk as ArrayBuffer);
  }
  throw new TypeError(
    `aws-chunked encoding: unsupported stream chunk type ${Object.prototype.toString.call(chunk)}; ` +
      `expected string, Uint8Array, ArrayBufferView or ArrayBuffer.`
  );
};

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
  // Checksum the bytes actually sent; the browser streamHasher only reads Blobs.
  const hash: Checksum | Hash | undefined = checksumRequired ? new checksumAlgorithmFn!() : undefined;

  const encoder = new TextEncoder();
  // ToDo: Validate the ReadableStream and getReader() is accessible before calling.
  // ReactNative doesn't support ReadableStream. They might not be available in older browsers, or some polyfills.
  const reader = readableStream.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          controller.enqueue(encoder.encode(`0\r\n`));
          if (hash) {
            const checksum = base64Encoder!(await hash.digest());
            controller.enqueue(encoder.encode(`${checksumLocationName}:${checksum}\r\n\r\n`));
          }
          controller.close();
          return;
        }

        const bytes = toBytes(value, encoder);
        // A zero-length chunk would terminate the body.
        if (bytes.byteLength === 0) {
          continue;
        }
        hash?.update(bytes);
        controller.enqueue(encoder.encode(`${bytes.byteLength.toString(16)}\r\n`));
        controller.enqueue(bytes);
        controller.enqueue(encoder.encode("\r\n"));
        return;
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
};
