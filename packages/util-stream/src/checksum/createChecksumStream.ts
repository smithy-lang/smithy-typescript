import type { Readable } from "stream";

import { isReadableStream } from "../stream-type-check";
import type { ChecksumStreamInit } from "./ChecksumStream";
import { ChecksumStream } from "./ChecksumStream";
import type { ReadableStreamType } from "./createChecksumStream.browser";
import { createChecksumStream as createChecksumStreamWeb } from "./createChecksumStream.browser";

/**
 * Creates a stream mirroring the input stream's interface, but
 * performs checksumming when reading to the end of the stream.
 * @internal
 */
export function createChecksumStream(init: ChecksumStreamInit<ReadableStreamType>): ReadableStreamType;
/**
 * @internal
 */
export function createChecksumStream(init: ChecksumStreamInit<Readable>): Readable;
/**
 * @internal
 */
export function createChecksumStream(
  init: ChecksumStreamInit<Readable | ReadableStreamType>
): Readable | ReadableStreamType {
  if (typeof ReadableStream === "function" && isReadableStream(init.source)) {
    return createChecksumStreamWeb(init as ChecksumStreamInit<ReadableStreamType>);
  }
  return new ChecksumStream(init as ChecksumStreamInit<Readable>);
}
