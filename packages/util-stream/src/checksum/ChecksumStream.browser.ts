import { Checksum, Encoder } from "@smithy/types";

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

const ReadableStreamRef = typeof ReadableStream === "function" ? ReadableStream : function (): void {};

/**
 * This stub exists so that the readable returned by createChecksumStream
 * identifies as "ChecksumStream" in alignment with the Node.js
 * implementation.
 *
 * @extends ReadableStream
 */
export class ChecksumStream extends (ReadableStreamRef as any) {}
