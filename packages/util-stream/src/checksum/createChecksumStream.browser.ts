import { Checksum, Encoder } from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";

/**
 * @internal
 */
export interface ChecksumStreamInit {
  /**
   * Base64 value of the expected checksum.
   */
  expectedChecksum: string;
  /**
   * For error messaging, the location from which the checksum value was read.
   */
  checksumSourceLocation: string;
  /**
   * The checksum calculator.
   */
  checksum: Checksum;
  /**
   * The stream to be checked.
   */
  source: ReadableStream;

  /**
   * Optional base 64 encoder if calling from a request context.
   */
  base64Encoder?: Encoder;
}

/**
 * Alias prevents compiler from turning
 * ReadableStream into ReadableStream<any>, which is incompatible
 * with the NodeJS.ReadableStream global type.
 */
export type ReadableStreamType = ReadableStream;

/**
 * @internal
 *
 * Creates a stream adapter for throwing checksum errors for streams without
 * buffering the stream.
 */
export const createChecksumStream = ({
  expectedChecksum,
  checksum,
  source,
  checksumSourceLocation,
  base64Encoder,
}: ChecksumStreamInit): ReadableStreamType => {
  if (!(source instanceof ReadableStream)) {
    throw new Error(
      `@smithy/util-stream: unsupported source type ${(source as any)?.constructor?.name ?? source} in ChecksumStream.`
    );
  }

  const encoder = base64Encoder ?? toBase64;

  if (typeof TransformStream !== "function") {
    throw new Error(
      "@smithy/util-stream: unable to instantiate ChecksumStream because API unavailable: ReadableStream/TransformStream."
    );
  }

  const transform = new TransformStream({
    start() {},
    transform: async (chunk: any, controller: TransformStreamDefaultController) => {
      /**
       * When the upstream source finishes, perform the checksum comparison.
       */
      if (null === chunk) {
        const digest: Uint8Array = await checksum.digest();
        const received = encoder(digest);

        if (expectedChecksum !== received) {
          const error = new Error(
            `Checksum mismatch: expected "${expectedChecksum}" but received "${received}"` +
              ` in response header "${checksumSourceLocation}".`
          );
          controller.error(error);
          throw error;
        }
        controller.terminate();
        return;
      }
      /**
       * When the upstream source flows data to this stream,
       * calculate a step update of the checksum.
       */
      checksum.update(chunk);
      controller.enqueue(chunk);
    },
    flush() {},
  });

  source.pipeThrough(transform);
  return transform.readable;
};
