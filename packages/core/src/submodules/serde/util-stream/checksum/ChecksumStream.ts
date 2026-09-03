import { Readable } from "node:stream";
import type { Checksum, ChecksumSource, ChecksumValidationResult, Encoder } from "@smithy/types";

import { fromBase64 } from "../../util-base64/fromBase64";
import { toBase64 } from "../../util-base64/toBase64";
import { ChecksumMismatchError } from "./ChecksumMismatchError";
import type { ChecksumStreamInitBase } from "./ChecksumStreamInitBase";

/**
 * @internal
 */
export interface ChecksumStreamInit<T extends Readable | ReadableStream> extends ChecksumStreamInitBase {
  /**
   * The stream to be checked.
   */
  source: T;
}

/**
 * Wrapper for throwing checksum errors for streams without
 * buffering the stream.
 *
 * Note: this effectively behaves as a duplex, reading from the source on one
 * side and forwarding chunks to its own readable side on the other. It should
 * not be rewritten back into a Duplex (or Transform). The source is observed
 * and driven manually (pause/resume in onSourceData/_read) so data is pulled
 * at the rate it is consumed and never buffered twice; this manual control is
 * used deliberately for performance and would be lost with the built-in duplex
 * machinery.
 *
 * @internal
 */
export class ChecksumStream extends Readable {
  private readonly expectedChecksum: string | (() => Promise<string>);
  private readonly checksumSourceLocation: string;
  private checksum: Checksum;
  private source: Readable;
  private readonly base64Encoder: Encoder;
  private readonly algorithm?: string;
  private readonly checksumSource?: ChecksumSource;
  private readonly holdBackLastChunk: boolean;
  private readonly isProtocolError?: (error: unknown) => boolean;
  private readonly onResult?: (result: ChecksumValidationResult) => void;

  /**
   * The most recent chunk, withheld from the readable side until the checksum
   * comparison succeeds. Only used when holdBackLastChunk is enabled.
   */
  private heldChunk: Buffer | undefined;

  /**
   * Guards onResult so that it is called at most once.
   */
  private settled = false;

  public constructor({
    expectedChecksum,
    checksum,
    source,
    checksumSourceLocation,
    base64Encoder,
    algorithm,
    checksumSource,
    holdBackLastChunk,
    isProtocolError,
    onResult,
  }: ChecksumStreamInit<Readable>) {
    super();
    if (typeof (source as Readable).pipe !== "function") {
      throw new Error(
        `@smithy/util-stream: unsupported source type ${source?.constructor?.name ?? source} in ChecksumStream.`
      );
    }
    this.source = source as Readable;

    this.base64Encoder = base64Encoder ?? toBase64;
    this.expectedChecksum = expectedChecksum;
    this.checksum = checksum;
    this.checksumSourceLocation = checksumSourceLocation;
    this.algorithm = algorithm;
    this.checksumSource = checksumSource;
    this.holdBackLastChunk = holdBackLastChunk ?? false;
    this.isProtocolError = isProtocolError;
    this.onResult = onResult;

    // Observe the source, updating the running checksum and forwarding each
    // chunk to this stream's readable side. The source is paused immediately
    // and is only resumed while this stream is being read (see _read), so data
    // is pulled at the rate it is consumed and is never buffered twice.
    this.source.on("data", this.onSourceData);
    this.source.on("end", this.onSourceEnd);
    this.source.on("error", this.onSourceError);
    this.source.on("close", this.onSourceClose);
    this.source.pause();
  }

  /**
   * Report the terminal validation outcome, at most once.
   */
  private settle(result: ChecksumValidationResult): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.onResult?.(result);
  }

  /**
   * Update the checksum and forward each source chunk to the readable side,
   * pausing the source when the readable side signals backpressure.
   */
  private onSourceData = (chunk: Buffer): void => {
    if (this.destroyed) {
      return;
    }
    try {
      this.checksum.update(chunk);
    } catch (e: unknown) {
      this.heldChunk = undefined;
      this.settle({
        status: "FAILED",
        validationPerformed: false,
        validationAlgorithm: this.algorithm,
        source: this.checksumSource,
      });
      this.destroy(e as Error);
      return;
    }
    if (!this.holdBackLastChunk) {
      if (!this.push(chunk)) {
        this.source.pause();
      }
      return;
    }
    /**
     * Release the previously withheld chunk and withhold the new one. The
     * source is left flowing when there was nothing to release, so that the
     * next chunk (or the end of the source) is reached.
     */
    const release = this.heldChunk;
    this.heldChunk = chunk;
    if (release !== undefined && !this.push(release)) {
      this.source.pause();
    }
  };

  /**
   * When the source finishes, perform the checksum comparison and end this stream.
   */
  private onSourceEnd = async (): Promise<void> => {
    if (this.destroyed) {
      return;
    }

    let expected: string;
    let received: string;
    try {
      if (typeof this.expectedChecksum === "function") {
        expected = await this.expectedChecksum();
        // Validate deferred trailer Base64 before comparison; the decoded bytes are not needed.
        fromBase64(expected);
      } else {
        expected = this.expectedChecksum;
      }
      const digest: Uint8Array = await this.checksum.digest();
      received = this.base64Encoder(digest);
    } catch (e: unknown) {
      // The expected value could not be obtained, the digest failed, or the
      // digest could not be encoded, so no comparison took place.
      this.heldChunk = undefined;
      this.settle({
        status: "FAILED",
        validationPerformed: false,
        validationAlgorithm: this.algorithm,
        source: this.checksumSource,
      });
      this.destroy(e as Error);
      return;
    }

    if (expected !== received) {
      // Discard the withheld chunk so unvalidated bytes are never delivered.
      this.heldChunk = undefined;
      this.settle({
        status: "FAILED",
        validationPerformed: true,
        validationAlgorithm: this.algorithm,
        source: this.checksumSource,
        receivedChecksum: expected,
        calculatedChecksum: received,
      });
      this.destroy(
        new ChecksumMismatchError({
          receivedChecksum: expected,
          calculatedChecksum: received,
          sourceLocation: this.checksumSourceLocation,
          algorithm: this.algorithm,
          source: this.checksumSource,
        })
      );
      return;
    }

    this.settle({
      status: "SUCCEEDED",
      validationPerformed: true,
      validationAlgorithm: this.algorithm,
      source: this.checksumSource,
      receivedChecksum: expected,
      calculatedChecksum: received,
    });

    if (this.heldChunk !== undefined) {
      const release = this.heldChunk;
      this.heldChunk = undefined;
      this.push(release);
    }
    this.push(null);
  };

  /**
   * Surface source errors on this stream. Protocol errors make validation
   * fail; transport errors continue through destruction as incomplete.
   */
  private onSourceError = (error: Error): void => {
    if (this.isProtocolError?.(error)) {
      this.heldChunk = undefined;
      this.settle({
        status: "FAILED",
        validationPerformed: false,
        validationAlgorithm: this.algorithm,
        source: this.checksumSource,
      });
    }
    this.destroy(error);
  };

  /**
   * If the source stream closes without having ended,
   * this is considered an error.
   */
  private onSourceClose = (): void => {
    if (!this.destroyed && !this.source.readableEnded) {
      this.destroy(new Error("Connection lost or stream closed before all data was received."));
    }
  };

  /**
   * Resume the source so it flows at the rate this stream is consumed.
   * Do not call this directly.
   * @internal
   */
  public _read(_size: number): void {
    this.source.resume();
  }

  /**
   * Destroy the upstream source for cleanup so it is not left dangling, then
   * complete this stream's destruction. The error is intentionally not forwarded
   * to the source as the source is typically internal and without an error listener
   * The error still surfaces on this stream via the callback.
   * Do not call this directly.
   * @internal
   */
  public _destroy(error: Error | null, callback: (error?: Error | null | undefined) => void): void {
    /**
     * Reaching here before the comparison has settled means the stream was
     * cancelled, destroyed, or lost its connection, so no comparison ran. A
     * successful end of stream and a mismatch both settle before destroying,
     * so this is a no-op in those cases.
     */
    this.heldChunk = undefined;
    this.settle({
      status: "INCOMPLETE",
      validationPerformed: false,
      validationAlgorithm: this.algorithm,
      source: this.checksumSource,
    });
    this.source?.removeListener("data", this.onSourceData);
    this.source?.removeListener("end", this.onSourceEnd);
    this.source?.removeListener("error", this.onSourceError);
    this.source?.removeListener("close", this.onSourceClose);
    this.source?.destroy();
    callback(error);
  }
}
