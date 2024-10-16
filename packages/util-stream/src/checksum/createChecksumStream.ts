import { Readable } from "stream";

import { isReadableStream } from "../stream-type-check";
import { ChecksumStream, ChecksumStreamInit } from "./ChecksumStream";
import { createChecksumStream as createChecksumStreamWeb, ReadableStreamType } from "./createChecksumStream.browser";

/**
 * @internal
 *
 * Creates a stream mirroring the input stream's interface, but
 * performs checksumming when reading to the end of the stream.
 */
export function createChecksumStream(init: ChecksumStreamInit<ReadableStreamType>): ReadableStreamType;
export function createChecksumStream(init: ChecksumStreamInit<Readable>): Readable;
export function createChecksumStream(
  init: ChecksumStreamInit<Readable | ReadableStreamType>
): Readable | ReadableStreamType {
  if (typeof ReadableStream === "function" && isReadableStream(init.source)) {
    return createChecksumStreamWeb(init as ChecksumStreamInit<ReadableStreamType>);
  }
  return new ChecksumStream(init as ChecksumStreamInit<Readable>);
}
