import type { ChecksumSource } from "@smithy/types";

/**
 * Stable error code for a checksum mismatch.
 * @internal
 */
export const CHECKSUM_MISMATCH = "CHECKSUM_MISMATCH";

/**
 * The structured fields of a {@link ChecksumMismatchError}.
 *
 * This is also the shape returned by {@link ChecksumMismatchError.toJSON}, so
 * an error transferred across a boundary that does not preserve custom error
 * properties (for example `postMessage` between a worker and the main thread)
 * can be reconstructed with `new ChecksumMismatchError(json)`.
 *
 * @internal
 */
export interface ChecksumMismatchErrorInit {
  /**
   * The checksum value received on the wire.
   */
  receivedChecksum: string;

  /**
   * The checksum value calculated locally over the received bytes.
   */
  calculatedChecksum: string;

  /**
   * The location the expected value was read from, used in the error message.
   */
  sourceLocation: string;

  /**
   * The algorithm used, as a protocol-defined string.
   */
  algorithm?: string;

  /**
   * Whether the expected value came from a stored header or a body trailer.
   */
  source?: ChecksumSource;
}

/**
 * Raised when a checksum calculated over received bytes does not match the
 * value supplied by the service.
 *
 * This is a non-transient client integrity error. It deliberately does not
 * carry a `$retryable` property: retrying is not correct, because a second
 * successful response would mask an integrity failure in the response that was
 * already delivered.
 *
 * @internal
 */
export class ChecksumMismatchError extends Error {
  /**
   * Stable error code, for consumers that cannot rely on `instanceof` across
   * realm or module boundaries.
   */
  public readonly code: typeof CHECKSUM_MISMATCH;
  public readonly receivedChecksum: string;
  public readonly calculatedChecksum: string;
  public readonly sourceLocation: string;
  public readonly algorithm?: string;
  public readonly source?: ChecksumSource;

  public constructor(init: ChecksumMismatchErrorInit) {
    /**
     * Note the wording of this message predates the received/calculated
     * terminology and is preserved verbatim for compatibility: its "expected"
     * value is `receivedChecksum` (the wire value) and its "received" value is
     * `calculatedChecksum` (the local value). Prefer the structured fields.
     */
    super(
      `Checksum mismatch: expected "${init.receivedChecksum}" but received "${init.calculatedChecksum}"` +
        ` in response header "${init.sourceLocation}".`
    );
    this.name = "ChecksumMismatchError";
    this.code = CHECKSUM_MISMATCH;
    this.receivedChecksum = init.receivedChecksum;
    this.calculatedChecksum = init.calculatedChecksum;
    this.sourceLocation = init.sourceLocation;
    this.algorithm = init.algorithm;
    this.source = init.source;
  }

  /**
   * The structured fields of this error, for transfer across boundaries that
   * drop custom error properties.
   */
  public toJSON(): ChecksumMismatchErrorInit {
    return {
      receivedChecksum: this.receivedChecksum,
      calculatedChecksum: this.calculatedChecksum,
      sourceLocation: this.sourceLocation,
      algorithm: this.algorithm,
      source: this.source,
    };
  }
}
