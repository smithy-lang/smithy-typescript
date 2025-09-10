import { toBase64 } from "@smithy/util-base64";

import { isReadableStream } from "../stream-type-check";
import type { ChecksumStreamInit } from "./ChecksumStream.browser";
import { ChecksumStream } from "./ChecksumStream.browser";

/**
 * @internal
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
