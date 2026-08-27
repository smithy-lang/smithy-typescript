/**
 * Stable error code for malformed `aws-chunked` framing.
 * @internal
 */
export const AWS_CHUNKED_MALFORMED = "AWS_CHUNKED_MALFORMED";

/**
 * Raised when `aws-chunked` response framing cannot be decoded.
 *
 * This covers malformed chunk-size lines, missing delimiters, truncated
 * framing, resource-limit violations, a declared trailer that never arrived,
 * and a decoded byte count that disagrees with the declared decoded length.
 *
 * Callers are expected to surface this as a protocol deserialization failure.
 * It is a non-transient error: retrying cannot repair framing the service
 * already sent.
 *
 * @internal
 */
export class AwsChunkedDecodeError extends Error {
  /**
   * Stable error code, for consumers that cannot rely on `instanceof` across
   * realm or module boundaries.
   */
  public readonly code: typeof AWS_CHUNKED_MALFORMED;

  public constructor(message: string) {
    super(`@smithy/core/serde: malformed aws-chunked response. ${message}`);
    this.name = "AwsChunkedDecodeError";
    this.code = AWS_CHUNKED_MALFORMED;
  }
}
