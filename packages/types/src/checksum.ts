import type { SourceData } from "./crypto";

/**
 * An object that provides a checksum of data provided in chunks to `update`.
 * The checksum may be performed incrementally as chunks are received or all
 * at once when the checksum is finalized, depending on the underlying
 * implementation.
 * It's recommended to compute checksum incrementally to avoid reading the
 * entire payload in memory.
 * A class that implements this interface may accept an optional secret key in its
 * constructor while computing checksum value, when using HMAC. If provided,
 * this secret key would be used when computing checksum.
 *
 * @public
 */
export interface Checksum {
  /**
   * Constant length of the digest created by the algorithm in bytes.
   */
  digestLength?: number;

  /**
   * Creates a new checksum object that contains a deep copy of the internal
   * state of the current `Checksum` object.
   */
  copy?(): Checksum;

  /**
   * Returns the digest of all of the data passed.
   */
  digest(): Promise<Uint8Array>;

  /**
   * Allows marking a checksum for checksums that support the ability
   * to mark and reset.
   *
   * @param readLimit - The maximum limit of bytes that can be read
   *   before the mark position becomes invalid.
   */
  mark?(readLimit: number): void;

  /**
   * Resets the checksum to its initial value.
   */
  reset(): void;

  /**
   * Adds a chunk of data for which checksum needs to be computed.
   * This can be called many times with new data as it is streamed.
   *
   * Implementations may override this method which passes second param
   * which makes Checksum object stateless.
   *
   * @param chunk - The buffer to update checksum with.
   */
  update(chunk: Uint8Array): void;
}

/**
 * A constructor for a Checksum that may be used to calculate an HMAC. Implementing
 * classes should not directly hold the provided key in memory beyond the
 * lexical scope of the constructor.
 *
 * @public
 */
export interface ChecksumConstructor {
  new (secret?: SourceData): Checksum;
}

/**
 * Where the expected checksum value for a response was obtained.
 *
 * - `STORED`: an initial response header carrying a checksum persisted
 *   alongside the object.
 * - `STREAM`: a trailer in the framed response body, carrying a checksum
 *   calculated by the service over the bytes it sent.
 *
 * @public
 */
export type ChecksumSource = "STORED" | "STREAM";

/**
 * The state of a response checksum validation.
 *
 * Because a streaming response is returned before its body is consumed, the
 * outcome of validation is not known when the operation resolves. `PENDING`
 * is therefore the initial state for a selected streaming checksum, and is
 * the only state that is not a terminal {@link ChecksumValidationResult}.
 *
 * - `PENDING`: a checksum was selected but the body has not reached its end.
 *   A body that is abandoned without an observable cancellation stays
 *   `PENDING`, because there is no way to know the consumer will not resume.
 * - `SUCCEEDED`: the comparison ran and the checksums matched.
 * - `NOT_PERFORMED`: no checksum was eligible, so none was computed.
 * - `INCOMPLETE`: the body was cancelled, destroyed, or closed before its
 *   normal end of stream, so no comparison ran.
 * - `FAILED`: the comparison ran and the checksums differed, or the expected
 *   value could not be obtained.
 *
 * @public
 */
export type ChecksumValidationStatus = "PENDING" | "SUCCEEDED" | "NOT_PERFORMED" | "INCOMPLETE" | "FAILED";

/**
 * The terminal outcome of a response checksum validation.
 *
 * @public
 */
export interface ChecksumValidationResult {
  /**
   * The terminal status. `PENDING` is excluded because a result only exists
   * once validation has settled.
   */
  status: Exclude<ChecksumValidationStatus, "PENDING">;

  /**
   * Whether a checksum comparison actually ran. This is `true` only for
   * `SUCCEEDED` and for a `FAILED` mismatch; it is `false` when no checksum
   * was eligible, when the body ended early, and when the expected value
   * could not be obtained.
   */
  validationPerformed: boolean;

  /**
   * The algorithm used, when one was selected.
   *
   * This is a plain string rather than the unrelated {@link ChecksumAlgorithm}
   * extension interface, and is deliberately not constrained to a fixed set:
   * the set of algorithms is defined by the protocol in use, not by this
   * package.
   */
  validationAlgorithm?: string;

  /**
   * Where the expected value came from, when a checksum was selected.
   */
  source?: ChecksumSource;

  /**
   * The checksum value received on the wire, when one was read.
   */
  receivedChecksum?: string;

  /**
   * The checksum value calculated locally over the received bytes, when the
   * digest was computed.
   */
  calculatedChecksum?: string;
}

/**
 * A handle for observing a response checksum validation that may not have
 * settled when the operation returns.
 *
 * `status` reflects the current state synchronously. `result` resolves once
 * validation settles, and resolves rather than rejects even for `FAILED`, so
 * that consumers who rely only on the body's error channel do not produce an
 * unhandled rejection. The body remains the operation's error channel.
 *
 * @public
 */
export interface ChecksumValidationHandle {
  readonly status: ChecksumValidationStatus;
  readonly result: Promise<ChecksumValidationResult>;
}
