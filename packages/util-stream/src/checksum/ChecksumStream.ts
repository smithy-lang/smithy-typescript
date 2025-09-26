import type { Checksum, Encoder } from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";
import type { Readable } from "stream";
import { Duplex } from "stream";

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
 * @internal
 *
 * Wrapper for throwing checksum errors for streams without
 * buffering the stream.
 *
 */
export class ChecksumStream extends Duplex {
  private expectedChecksum: string;
  private checksumSourceLocation: string;
  private checksum: Checksum;
  private source?: Readable;
  private base64Encoder: Encoder;

  public constructor({
    expectedChecksum,
    checksum,
    source,
    checksumSourceLocation,
    base64Encoder,
  }: ChecksumStreamInit<Readable>) {
    super();
    if (typeof (source as Readable).pipe === "function") {
      this.source = source as Readable;
    } else {
      throw new Error(
        `@smithy/util-stream: unsupported source type ${source?.constructor?.name ?? source} in ChecksumStream.`
      );
    }

    this.base64Encoder = base64Encoder ?? toBase64;
    this.expectedChecksum = expectedChecksum;
    this.checksum = checksum;
    this.checksumSourceLocation = checksumSourceLocation;

    // connect this stream to the end of the source stream.
    this.source.pipe(this);
  }

  /**
   * @internal do not call this directly.
   */
  public _read(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    size: number
  ): void {}

  /**
   * @internal do not call this directly.
   *
   * When the upstream source flows data to this stream,
   * calculate a step update of the checksum.
   */
  public _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void): void {
    try {
      this.checksum.update(chunk);
      this.push(chunk);
    } catch (e: unknown) {
      return callback(e as Error);
    }
    return callback();
  }

  /**
   * @internal do not call this directly.
   *
   * When the upstream source finishes, perform the checksum comparison.
   */
  public async _final(callback: (err?: Error) => void): Promise<void> {
    try {
      const digest: Uint8Array = await this.checksum.digest();
      const received = this.base64Encoder(digest);
      if (this.expectedChecksum !== received) {
        return callback(
          new Error(
            `Checksum mismatch: expected "${this.expectedChecksum}" but received "${received}"` +
              ` in response header "${this.checksumSourceLocation}".`
          )
        );
      }
    } catch (e: unknown) {
      return callback(e as Error);
    }
    this.push(null);
    return callback();
  }
}
