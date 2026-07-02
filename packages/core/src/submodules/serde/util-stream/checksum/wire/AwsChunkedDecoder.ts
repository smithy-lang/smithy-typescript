/**
 * Handlers invoked by {@link AwsChunkedDecoder} as it decodes an
 * `aws-chunked` encoded stream.
 *
 * @internal
 */
export interface AwsChunkedDecoderHandlers {
  /**
   * Called with each segment of decoded data bytes (framing stripped).
   * May be called multiple times per {@link AwsChunkedDecoder.write}.
   */
  onData(chunk: Uint8Array): void;
  /**
   * Called once per trailer line found after the terminal chunk.
   * @param name - the trailer field name (as received, not normalized).
   * @param value - the trailer field value.
   */
  onTrailer(name: string, value: string): void;
}

const CR = 0x0d; // \r
const LF = 0x0a; // \n

type State = "CHUNK_HEADER" | "CHUNK_DATA" | "CHUNK_DATA_CRLF" | "TRAILER" | "DONE";

/**
 * Incremental decoder for `aws-chunked` encoded response bodies.
 *
 * Data is fed in arbitrarily sized segments via {@link write}. Decoded data
 * bytes are surfaced through {@link AwsChunkedDecoderHandlers.onData} as soon
 * as they are available - the decoder never buffers the full payload. Trailer
 * fields appended after the terminal chunk are surfaced through
 * {@link AwsChunkedDecoderHandlers.onTrailer}.
 *
 * Wire format (see the S3 Wire Checksum spec):
 * ```
 * <HEX-SIZE>[;chunk-ext]\r\n<data bytes>\r\n   (repeated)
 * 0[;chunk-ext]\r\n                            (terminal chunk, size 0)
 * <trailer-name>: <value>\r\n                  (zero or more trailers)
 * \r\n                                         (end of trailers)
 * ```
 *
 * The chunk extension (e.g. `;chunk-signature=UNSIGNED-PAYLOAD`) is parsed and
 * ignored - no assumption is made about its value, for forward compatibility.
 *
 * @internal
 */
export class AwsChunkedDecoder {
  private state: State = "CHUNK_HEADER";
  /**
   * Accumulates bytes of the current control line (chunk header or trailer).
   * Data bytes are never accumulated here - they are emitted directly.
   */
  private lineBuffer: number[] = [];
  /**
   * Remaining number of data bytes to read for the current chunk.
   */
  private chunkRemaining = 0;
  /**
   * Remaining number of CRLF bytes to consume after a chunk's data.
   */
  private crlfRemaining = 0;
  /**
   * Total number of decoded data bytes emitted so far.
   */
  private decodedByteCount = 0;

  public constructor(private readonly handlers: AwsChunkedDecoderHandlers) {}

  /**
   * The number of decoded data bytes emitted so far. After the stream is fully
   * decoded this equals the `x-amz-decoded-content-length`.
   */
  public get bytesDecoded(): number {
    return this.decodedByteCount;
  }

  /**
   * Feed a segment of encoded bytes into the decoder.
   * @param input - a slice of the aws-chunked encoded stream.
   */
  public write(input: Uint8Array): void {
    let offset = 0;
    const length = input.length;

    while (offset < length) {
      switch (this.state) {
        case "CHUNK_HEADER": {
          while (offset < length) {
            const byte = input[offset++];
            if (byte === LF) {
              this.parseChunkHeader();
              break;
            } else if (byte !== CR) {
              this.lineBuffer.push(byte);
            }
          }
          break;
        }
        case "CHUNK_DATA": {
          const take = Math.min(this.chunkRemaining, length - offset);
          if (take > 0) {
            const data = input.subarray(offset, offset + take);
            this.decodedByteCount += take;
            this.chunkRemaining -= take;
            offset += take;
            this.handlers.onData(data);
          }
          if (this.chunkRemaining === 0) {
            this.state = "CHUNK_DATA_CRLF";
            this.crlfRemaining = 2;
          }
          break;
        }
        case "CHUNK_DATA_CRLF": {
          while (offset < length && this.crlfRemaining > 0) {
            const byte = input[offset++];
            if (byte !== CR && byte !== LF) {
              throw new Error("@smithy/util-stream: aws-chunked decode error - expected CRLF after chunk data.");
            }
            this.crlfRemaining--;
          }
          if (this.crlfRemaining === 0) {
            this.state = "CHUNK_HEADER";
          }
          break;
        }
        case "TRAILER": {
          while (offset < length) {
            const byte = input[offset++];
            if (byte === LF) {
              if (this.parseTrailerLine()) {
                this.state = "DONE";
              }
              break;
            } else if (byte !== CR) {
              this.lineBuffer.push(byte);
            }
          }
          break;
        }
        case "DONE": {
          // Ignore any bytes received after the trailer terminator.
          offset = length;
          break;
        }
      }
    }
  }

  /**
   * Signal that the upstream source has ended. Throws if the stream ended
   * before the terminal chunk and trailers were fully received.
   */
  public end(): void {
    if (this.state !== "DONE") {
      throw new Error(
        "@smithy/util-stream: aws-chunked decode error - stream ended before the terminal chunk and trailers were received."
      );
    }
  }

  /**
   * Parse the accumulated chunk header line and transition state.
   */
  private parseChunkHeader(): void {
    const line = this.takeLine();
    // Strip any chunk extension (e.g. ";chunk-signature=UNSIGNED-PAYLOAD").
    const semicolon = line.indexOf(";");
    const hex = (semicolon === -1 ? line : line.slice(0, semicolon)).trim();

    if (hex.length === 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error(`@smithy/util-stream: aws-chunked decode error - invalid chunk size "${hex}".`);
    }

    const size = parseInt(hex, 16);
    if (size === 0) {
      this.state = "TRAILER";
    } else {
      this.chunkRemaining = size;
      this.state = "CHUNK_DATA";
    }
  }

  /**
   * Parse the accumulated trailer line.
   * @returns true when the trailer section is terminated (empty line).
   */
  private parseTrailerLine(): boolean {
    const line = this.takeLine();
    if (line.length === 0) {
      return true;
    }
    const separator = line.indexOf(":");
    if (separator === -1) {
      throw new Error(`@smithy/util-stream: aws-chunked decode error - malformed trailer "${line}".`);
    }
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    this.handlers.onTrailer(name, value);
    return false;
  }

  /**
   * Consume and return the accumulated control line as a string, resetting the
   * line buffer.
   */
  private takeLine(): string {
    const line = String.fromCharCode(...this.lineBuffer);
    this.lineBuffer = [];
    return line;
  }
}
