/**
 * A trailer field parsed from an `aws-chunked` response.
 *
 * Field order, original name spelling, and duplicates are preserved. Consumers
 * perform case-insensitive lookup without collapsing the ordered fields.
 *
 * @internal
 */
export interface TrailerField {
  readonly name: string;
  readonly value: string;
}

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
   * Trailer field names declared by the response. Every trailer field that
   * arrives must have a matching declaration. Compared case-insensitively.
   */
  declaredTrailers: readonly string[];

  /**
   * The decoded payload length declared by the response. The decoded byte count
   * is verified against it.
   */
  decodedContentLength: number;
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
   * The parsed trailer fields in wire order, retaining original field-name
   * spelling and duplicates.
   *
   * This is an internal channel. It resolves after the underlying source
   * reaches normal EOF, and rejects with the same error the body surfaces, so a
   * caller that only observes the body still sees every failure. It is
   * pre-handled internally, so ignoring it does not produce an unhandled
   * rejection.
   */
  trailers: Promise<readonly TrailerField[]>;
}
