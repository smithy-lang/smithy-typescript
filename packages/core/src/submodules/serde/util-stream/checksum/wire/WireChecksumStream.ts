import { Duplex, type Readable } from "node:stream";
import type { Checksum, Encoder } from "@smithy/types";

import { toBase64 } from "../../../util-base64/toBase64";
import { AwsChunkedDecoder } from "./AwsChunkedDecoder";

/**
 * @internal
 */
export interface WireChecksumStreamInit<T extends Readable | ReadableStream> {
  /**
   * The wire checksum algorithm name (e.g. `crc32`), as reported by the
   * `x-amz-wire-checksum-algorithm` response header. Used to derive the
   * trailer field name (`x-amz-wire-checksum-<algorithm>`).
   */
  checksumAlgorithm: string;

  /**
   * The checksum calculator. Updated incrementally over the decoded data bytes.
   */
  checksum: Checksum;

  /**
   * The `aws-chunked` encoded stream carrying the response body. The framing is
   * decoded before being surfaced, and the checksum value is read from the
   * trailer.
   */
  source: T;

  /**
   * The `x-amz-decoded-content-length` value. When provided, the total decoded
   * byte count is verified against it. A mismatch indicates a truncated or
   * corrupt response.
   */
  decodedContentLength?: number;

  /**
   * Optional base 64 encoder if calling from a request context.
   */
  base64Encoder?: Encoder;
}

/**
 * Stream wrapper that validates an S3 wire checksum without buffering the full
 * response. It mirrors its source stream's interface.
 *
 * It decodes the `aws-chunked` framing so the caller only sees the decoded
 * object data, and reads the expected checksum from the trailer once the body
 * is fully consumed.
 *
 * @internal
 */
export class WireChecksumStream extends Duplex {
  private readonly checksum: Checksum;
  private readonly base64Encoder: Encoder;
  private readonly trailerName: string;
  private readonly decodedContentLength?: number;
  private readonly decoder: AwsChunkedDecoder;

  private source?: Readable;
  private expectedChecksum?: string;
  private canPushMore = true;
  private pendingCallback: ((err?: Error) => void) | null = null;

  public constructor({
    checksumAlgorithm,
    checksum,
    source,
    decodedContentLength,
    base64Encoder,
  }: WireChecksumStreamInit<Readable>) {
    super();
    if (typeof (source as Readable).pipe === "function") {
      this.source = source as Readable;
    } else {
      throw new Error(
        `@smithy/util-stream: unsupported source type ${source?.constructor?.name ?? source} in WireChecksumStream.`
      );
    }

    this.checksum = checksum;
    this.decodedContentLength = decodedContentLength;
    this.base64Encoder = base64Encoder ?? toBase64;
    this.trailerName = `x-amz-wire-checksum-${checksumAlgorithm.toLowerCase()}`;

    this.decoder = new AwsChunkedDecoder({
      onData: (data) => {
        this.checksum.update(data);
        if (!this.push(data)) {
          this.canPushMore = false;
        }
      },
      onTrailer: (name, value) => {
        if (name.toLowerCase() === this.trailerName) {
          this.expectedChecksum = value;
        }
      },
    });

    // connect this stream to the end of the source stream.
    this.source.pipe(this);
  }

  /**
   * Do not call this directly.
   * @internal
   */
  public _read(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    size: number
  ): void {
    if (this.pendingCallback) {
      const callback = this.pendingCallback;
      this.pendingCallback = null;
      callback();
    }
  }

  /**
   * When the upstream source flows data to this stream, decode the `aws-chunked`
   * framing and calculate a step update of the checksum over the decoded bytes.
   * Do not call this directly.
   * @internal
   */
  public _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void): void {
    try {
      this.canPushMore = true;
      // onData updates the checksum and pushes decoded bytes downstream.
      this.decoder.write(chunk);
      if (!this.canPushMore) {
        this.pendingCallback = callback;
        return;
      }
    } catch (e: unknown) {
      return callback(e as Error);
    }
    return callback();
  }

  /**
   * When the upstream source finishes, finalize decoding and perform the
   * checksum comparison against the value read from the trailer.
   * Do not call this directly.
   * @internal
   */
  public async _final(callback: (err?: Error) => void): Promise<void> {
    try {
      this.decoder.end();
      if (this.decodedContentLength !== undefined && this.decoder.bytesDecoded !== this.decodedContentLength) {
        return callback(
          new Error(
            `@smithy/util-stream: decoded content length mismatch: expected ${this.decodedContentLength}` +
              ` but decoded ${this.decoder.bytesDecoded} bytes from the aws-chunked response.`
          )
        );
      }
      if (this.expectedChecksum === undefined) {
        return callback(
          new Error(`@smithy/util-stream: wire checksum trailer "${this.trailerName}" was not present in the response.`)
        );
      }

      const digest: Uint8Array = await this.checksum.digest();
      const received = this.base64Encoder(digest);
      if (this.expectedChecksum !== received) {
        return callback(
          new Error(
            `Checksum mismatch: expected "${this.expectedChecksum}" but received "${received}"` +
              ` in response trailer "${this.trailerName}".`
          )
        );
      }
    } catch (e: unknown) {
      return callback(e as Error);
    }
    this.push(null);
    return callback();
  }

  /**
   * Destroy the upstream source for cleanup so it is not left dangling, then
   * complete this stream's destruction. The error is intentionally not forwarded
   * to the source as the source is typically internal and without an error listener.
   * The error still surfaces on this stream via the callback.
   * Do not call this directly.
   * @internal
   */
  public _destroy(error: Error | null, callback: (error?: Error | null | undefined) => void): void {
    this.source?.destroy();
    callback(error);
  }
}
