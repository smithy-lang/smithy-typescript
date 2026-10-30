/**
 * Raised when `aws-chunked` response framing cannot be decoded.
 *
 * This covers malformed chunk-size lines, missing delimiters, truncated
 * framing, resource-limit violations, trailer fields that were not declared,
 * and a decoded byte count that disagrees with the declared decoded length.
 *
 * Callers are expected to surface this as a protocol deserialization failure.
 * It is a non-transient error: retrying cannot repair framing the service
 * already sent.
 *
 * @internal
 */
export class AwsChunkedDecodeError extends Error {
  public constructor(message: string) {
    super(`@smithy/core/serde: malformed aws-chunked response. ${message}`);
    this.name = "AwsChunkedDecodeError";
  }
}
