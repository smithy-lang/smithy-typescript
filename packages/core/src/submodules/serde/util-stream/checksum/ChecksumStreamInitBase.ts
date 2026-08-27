import type { Checksum, ChecksumSource, ChecksumValidationResult, Encoder } from "@smithy/types";

/**
 * The runtime-independent options of a checksum stream.
 *
 * The Node.js and web variants of `ChecksumStreamInit` extend this and add only
 * their own `source` type, so that every other option stays identical across
 * runtimes. This module deliberately imports no stream types so that it is
 * safe to include in a browser or react-native bundle.
 *
 * @internal
 */
export interface ChecksumStreamInitBase {
  /**
   * Base64 value of the expected checksum, or a provider resolving to it.
   *
   * A provider is used when the expected value is not known until the source
   * has been read to its end, such as a checksum carried in a body trailer. It
   * is called at most once, after the source reaches its normal end of stream
   * and before the comparison.
   */
  expectedChecksum: string | (() => Promise<string>);

  /**
   * For error messaging, the location from which the checksum value was read.
   */
  checksumSourceLocation: string;

  /**
   * The checksum calculator.
   */
  checksum: Checksum;

  /**
   * Optional base 64 encoder if calling from a request context.
   */
  base64Encoder?: Encoder;

  /**
   * The algorithm in use, as a protocol-defined string. Reported in the
   * validation result and on a mismatch error.
   */
  algorithm?: string;

  /**
   * Whether the expected value came from a stored header or a body trailer.
   * Reported in the validation result and on a mismatch error.
   */
  checksumSource?: ChecksumSource;

  /**
   * Withhold the most recent chunk until the checksum has been compared
   * successfully, so that the final bytes of a payload are never delivered
   * after a failed comparison.
   *
   * This bounds the withheld data to a single source chunk rather than
   * buffering the payload. Earlier chunks may already have been consumed, so
   * streamed data is still not fully trusted until consumption completes
   * without error.
   *
   * @default false
   */
  holdBackLastChunk?: boolean;

  /**
   * Called exactly once when validation settles, with the terminal outcome.
   *
   * It is not called at all if the stream is abandoned without being destroyed
   * or cancelled, which leaves validation pending. `NOT_PERFORMED` is never
   * reported here, because this stream is only constructed once a checksum has
   * been selected.
   *
   * This callback must not throw.
   */
  onResult?: (result: ChecksumValidationResult) => void;
}
