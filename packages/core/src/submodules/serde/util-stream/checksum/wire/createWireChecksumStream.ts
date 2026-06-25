import type { Readable } from "node:stream";

import { isReadableStream } from "../../stream-type-check";
import { WireChecksumStream, type WireChecksumStreamInit } from "./WireChecksumStream";
import {
  createWireChecksumStream as createWireChecksumStreamWeb,
  type ReadableStreamType,
} from "./createWireChecksumStream.browser";

/**
 * Creates a stream mirroring the input stream's interface that validates an S3
 * wire checksum when reading to the end of the stream. It decodes the
 * `aws-chunked` framing so the caller only sees the decoded object data, and
 * reads the expected checksum from the trailer.
 * @internal
 */
export function createWireChecksumStream(init: WireChecksumStreamInit<ReadableStreamType>): ReadableStreamType;
/**
 * @internal
 */
export function createWireChecksumStream(init: WireChecksumStreamInit<Readable>): Readable;
/**
 * @internal
 */
export function createWireChecksumStream(
  init: WireChecksumStreamInit<Readable | ReadableStreamType>
): Readable | ReadableStreamType {
  if (typeof ReadableStream === "function" && isReadableStream(init.source)) {
    return createWireChecksumStreamWeb(init as WireChecksumStreamInit<ReadableStreamType>);
  }
  return new WireChecksumStream(init as WireChecksumStreamInit<Readable>);
}
