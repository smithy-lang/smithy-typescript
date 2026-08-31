import type { ChecksumValidationResult } from "@smithy/types";

import { toBase64 } from "../../util-base64/toBase64.browser";
import { isReadableStream } from "../stream-type-check";
import { ChecksumMismatchError } from "./ChecksumMismatchError";
import { ChecksumStream, type ChecksumStreamInit } from "./ChecksumStream.browser";

/**
 * Alias prevents compiler from turning
 * ReadableStream into ReadableStream<any>, which is incompatible
 * with the NodeJS.ReadableStream global type.
 * @internal
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
 * Creates a stream adapter for throwing checksum errors for streams without
 * buffering the stream.
 * @internal
 */
export const createChecksumStream = ({
  expectedChecksum,
  checksum,
  source,
  checksumSourceLocation,
  base64Encoder,
  algorithm,
  checksumSource,
  holdBackLastChunk,
  onResult,
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

  /**
   * Report the terminal validation outcome, at most once.
   */
  let settled = false;
  const settle = (result: ChecksumValidationResult): void => {
    if (settled) {
      return;
    }
    settled = true;
    onResult?.(result);
  };

  /**
   * The most recent chunk, withheld from the readable side until the checksum
   * comparison succeeds. Only used when holdBackLastChunk is enabled.
   */
  let heldChunk: any = undefined;

  const transform = new TransformStream({
    start() {},
    async transform(chunk: any, controller: TransformStreamDefaultController) {
      /**
       * When the upstream source flows data to this stream,
       * calculate a step update of the checksum.
       */
      checksum.update(chunk);

      if (!holdBackLastChunk) {
        controller.enqueue(chunk);
        return;
      }
      /**
       * Empty chunks contain no payload bytes to withhold. Forward them without
       * displacing the most recent non-empty chunk, which must remain held
       * until the checksum comparison succeeds.
       */
      if (chunk.byteLength === 0) {
        controller.enqueue(chunk);
        return;
      }
      /**
       * Release the previously withheld chunk and withhold the new one.
       */
      const release = heldChunk;
      heldChunk = chunk;
      if (release !== undefined) {
        controller.enqueue(release);
      }
    },
    async flush(controller: TransformStreamDefaultController) {
      let expected: string;
      let received: string;
      try {
        expected = typeof expectedChecksum === "function" ? await expectedChecksum() : expectedChecksum;
        const digest: Uint8Array = await checksum.digest();
        received = encoder(digest);
      } catch (e: unknown) {
        // The expected value could not be obtained, the digest failed, or the
        // digest could not be encoded, so no comparison took place.
        heldChunk = undefined;
        settle({
          status: "FAILED",
          validationPerformed: false,
          validationAlgorithm: algorithm,
          source: checksumSource,
        });
        controller.error(e);
        return;
      }

      if (expected !== received) {
        // Discard the withheld chunk so unvalidated bytes are never delivered.
        heldChunk = undefined;
        settle({
          status: "FAILED",
          validationPerformed: true,
          validationAlgorithm: algorithm,
          source: checksumSource,
          receivedChecksum: expected,
          calculatedChecksum: received,
        });
        controller.error(
          new ChecksumMismatchError({
            receivedChecksum: expected,
            calculatedChecksum: received,
            sourceLocation: checksumSourceLocation,
            algorithm,
            source: checksumSource,
          })
        );
        return;
      }

      settle({
        status: "SUCCEEDED",
        validationPerformed: true,
        validationAlgorithm: algorithm,
        source: checksumSource,
        receivedChecksum: expected,
        calculatedChecksum: received,
      });

      if (heldChunk !== undefined) {
        const release = heldChunk;
        heldChunk = undefined;
        controller.enqueue(release);
      }
      controller.terminate();
    },
  });

  source.pipeThrough(transform);
  const readable = transform.readable;

  if (!onResult) {
    Object.setPrototypeOf(readable, ChecksumStream.prototype);
    return readable;
  }

  /**
   * A TransformStream cannot observe cancellation of its readable side in a way
   * that is available across supported runtimes, and cancelling via a reader
   * does not invoke the readable's own cancel method. To report an incomplete
   * validation, the transformed readable is forwarded through an outer stream
   * whose cancel algorithm runs for both `cancel()` and `getReader().cancel()`.
   *
   * This wrapper is only installed when a result is being observed, so callers
   * that do not pass onResult keep the original single-hop pipeline.
   */
  const reader = readable.getReader();
  const observed = new ReadableStream(
    {
      async pull(controller) {
        let result;
        try {
          result = await reader.read();
        } catch (error) {
          heldChunk = undefined;
          settle({
            status: "INCOMPLETE",
            validationPerformed: false,
            validationAlgorithm: algorithm,
            source: checksumSource,
          });
          throw error;
        }
        const { value, done } = result;
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      },
      cancel(reason) {
        heldChunk = undefined;
        settle({
          status: "INCOMPLETE",
          validationPerformed: false,
          validationAlgorithm: algorithm,
          source: checksumSource,
        });
        return reader.cancel(reason);
      },
    },
    { highWaterMark: 0 }
  );

  Object.setPrototypeOf(observed, ChecksumStream.prototype);
  return observed;
};
