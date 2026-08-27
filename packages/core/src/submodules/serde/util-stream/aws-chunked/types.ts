/**
 * Options for decoding an `aws-chunked` response body.
 *
 * @internal
 */
export interface AwsChunkedResponseDecoderOptions<StreamType> {
  /**
   * The encoded response body.
   */
  source: StreamType;

  /**
   * Trailer field names the response declared, which must all arrive before the
   * framing is considered complete. Compared case-insensitively.
   */
  declaredTrailers?: readonly string[];

  /**
   * The decoded payload length the response declared, if any. The decoded byte
   * count is verified against it.
   */
  decodedContentLength?: number;
}

/**
 * The decoded body and the trailer section that followed it.
 *
 * @internal
 */
export interface AwsChunkedResponseDecoderResult<StreamType> {
  /**
   * The decoded payload, with all framing removed. Inner content encodings are
   * left untouched.
   */
  body: StreamType;

  /**
   * The parsed trailer fields, keyed by lowercased field name.
   *
   * This is an internal channel. It resolves when the terminal trailer section
   * has been consumed, and rejects with the same error the body surfaces, so a
   * caller that only observes the body still sees every failure. It is
   * pre-handled internally, so ignoring it does not produce an unhandled
   * rejection.
   */
  trailers: Promise<Record<string, string>>;
}
