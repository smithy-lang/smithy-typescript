import { Readable } from "node:stream";
import type { Checksum, Encoder } from "@smithy/types";

import { toBase64 } from "../../util-base64/toBase64";

/**
 * @internal
 */
export interface ChecksumStreamInit<T extends Readable | ReadableStream> {
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
  source: T;

  /**
   * Optional base 64 encoder if calling from a request context.
   */
  base64Encoder?: Encoder;
}

/**
 * Wrapper for throwing checksum errors for streams without
 * buffering the stream.
 *
 * @internal
 */
export class ChecksumStream extends Readable {
  private expectedChecksum: string;
  private checksumSourceLocation: string;
  private checksum: Checksum;
  private source: Readable;
  private base64Encoder: Encoder;

  public constructor({
    expectedChecksum,
    checksum,
    source,
    checksumSourceLocation,
    base64Encoder,
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

    // Observe the source, updating the running checksum and forwarding each
    // chunk to this stream's readable side. The source is paused immediately
    // and is only resumed while this stream is being read (see _read), so data
    // is pulled at the rate it is consumed and is never buffered twice.
    this.source.on("data", this.onSourceData);
    this.source.on("end", this.onSourceEnd);
    this.source.on("error", this.onSourceError);
    this.source.pause();
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
      this.destroy(e as Error);
      return;
    }
    if (!this.push(chunk)) {
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
    try {
      const digest: Uint8Array = await this.checksum.digest();
      const received = this.base64Encoder(digest);
      if (this.expectedChecksum !== received) {
        this.destroy(
          new Error(
            `Checksum mismatch: expected "${this.expectedChecksum}" but received "${received}"` +
              ` in response header "${this.checksumSourceLocation}".`
          )
        );
        return;
      }
    } catch (e: unknown) {
      this.destroy(e as Error);
      return;
    }
    this.push(null);
  };

  /**
   * Surface source errors on this stream.
   */
  private onSourceError = (error: Error): void => {
    this.destroy(error);
  };

  /**
   * Resume the source so it flows at the rate this stream is consumed.
   * Do not call this directly.
   * @internal
   */
  public _read(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    size: number
  ): void {
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
    this.source?.destroy();
    callback(error);
  }
}
