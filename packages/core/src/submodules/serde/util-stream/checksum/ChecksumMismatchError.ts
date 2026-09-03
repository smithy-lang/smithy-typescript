import type { ChecksumSource } from "@smithy/types";

/**
 * The structured fields of a {@link ChecksumMismatchError}.
 *
 * Every field is assigned as an enumerable own property on the error, so
 * `JSON.stringify` emits all of them and `new ChecksumMismatchError(json)`
 * reconstructs an equivalent error, `message` included. `stack` is not
 * preserved. Note that `postMessage` uses structured clone rather than JSON:
 * it keeps `message` and `stack` but drops these fields and yields a plain
 * `Error`, so a worker that needs them must serialize explicitly.
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
    this.receivedChecksum = init.receivedChecksum;
    this.calculatedChecksum = init.calculatedChecksum;
    this.sourceLocation = init.sourceLocation;
    this.algorithm = init.algorithm;
    this.source = init.source;
  }
}
