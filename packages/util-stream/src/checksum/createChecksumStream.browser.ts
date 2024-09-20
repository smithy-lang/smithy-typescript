import { Checksum, Encoder } from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";

import { isReadableStream } from "../stream-type-check";

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
 * This is a local copy of
 * https://developer.mozilla.org/en-US/docs/Web/API/TransformStreamDefaultController
 * in case users do not have this type.
 */
interface TransformStreamDefaultController {
  enqueue(chunk: any): void;
  error(error: unknown): void;
  terminate(): void;
}

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
  if (!isReadableStream(source)) {
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
    async transform(chunk: any, controller: TransformStreamDefaultController) {
      /**
       * When the upstream source flows data to this stream,
       * calculate a step update of the checksum.
       */
      checksum.update(chunk);
      controller.enqueue(chunk);
    },
    async flush(controller: TransformStreamDefaultController) {
      const digest: Uint8Array = await checksum.digest();
      const received = encoder(digest);

      if (expectedChecksum !== received) {
        const error = new Error(
          `Checksum mismatch: expected "${expectedChecksum}" but received "${received}"` +
            ` in response header "${checksumSourceLocation}".`
        );
        controller.error(error);
      } else {
        controller.terminate();
      }
    },
  });

  source.pipeThrough(transform);
  const readable = transform.readable;
  Object.setPrototypeOf(readable, ChecksumStream.prototype);
  return readable;
};

const ReadableStreamRef = typeof ReadableStream === "function" ? ReadableStream : function (): void {};

/**
 * This stub exists so that the readable returned by createChecksumStream
 * identifies as "ChecksumStream" in alignment with the Node.js
 * implementation.
 *
 * @extends ReadableStream
 */
export class ChecksumStream extends (ReadableStreamRef as any) {}
