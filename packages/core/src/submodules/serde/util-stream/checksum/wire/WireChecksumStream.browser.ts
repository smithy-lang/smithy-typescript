import type { Checksum, Encoder } from "@smithy/types";

/**
 * @internal
 */
export interface WireChecksumStreamInit {
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
  source: ReadableStream;

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

const ReadableStreamRef = typeof ReadableStream === "function" ? ReadableStream : function (): void {};

/**
 * This stub exists so that the readable returned by createWireChecksumStream
 * identifies as "WireChecksumStream" in alignment with the Node.js
 * implementation.
 *
 * @extends ReadableStream
 */
export class WireChecksumStream extends (ReadableStreamRef as any) {}
