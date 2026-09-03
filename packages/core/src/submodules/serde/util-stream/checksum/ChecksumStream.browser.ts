import type { ChecksumStreamInitBase } from "./ChecksumStreamInitBase";

/**
 * @internal
 */
export interface ChecksumStreamInit extends ChecksumStreamInitBase {
  /**
   * The stream to be checked.
   */
  source: ReadableStream;
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
