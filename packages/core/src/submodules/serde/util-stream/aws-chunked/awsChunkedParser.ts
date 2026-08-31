import { AwsChunkedDecodeError } from "./AwsChunkedDecodeError";

/**
 * Maximum length, in bytes, of a chunk-size line including its delimiter.
 * @internal
 */
export const MAX_CHUNK_CONTROL_LINE_LENGTH = 8 * 1024;

/**
 * Maximum length, in bytes, of a single trailer line including its delimiter.
 * @internal
 */
export const MAX_TRAILER_LINE_LENGTH = 8 * 1024;

/**
 * Maximum aggregate length, in bytes, of the whole trailer section.
 * @internal
 */
export const MAX_TRAILER_SECTION_LENGTH = 64 * 1024;

/**
 * Maximum number of fields permitted in the trailer section.
 * @internal
 */
export const MAX_TRAILER_FIELD_COUNT = 100;

const CR = 0x0d;
const LF = 0x0a;
const SEMICOLON = 0x3b;
const COLON = 0x3a;

const EMPTY = new Uint8Array(0);

/**
 * @internal
 */
export type AwsChunkedParserState = "CHUNK_SIZE" | "CHUNK_DATA" | "CHUNK_DATA_CRLF" | "TRAILER_LINES" | "COMPLETE";

/**
 * @internal
 */
export interface AwsChunkedParserOptions {
  /**
   * Trailer field names that the response declared and that must therefore
   * arrive before the framing is considered complete. Compared
   * case-insensitively.
   */
  declaredTrailers?: readonly string[];

  /**
   * The decoded payload length the response declared, if any. The decoded byte
   * count is compared against it.
   */
  decodedContentLength?: number;
}

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  if (a.byteLength === 0) {
    return b;
  }
  if (b.byteLength === 0) {
    return a;
  }
  const merged = new Uint8Array(a.byteLength + b.byteLength);
  merged.set(a, 0);
  merged.set(b, a.byteLength);
  return merged;
};

/**
 * Decode ASCII bytes without pulling in a UTF-8 decoder. Control data in
 * `aws-chunked` framing is ASCII by definition, and any byte outside that range
 * would fail the syntax checks that follow.
 */
const toAscii = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.byteLength; ++i) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
};

const isHexDigit = (code: number): boolean =>
  (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);

/**
 * A single-pass `aws-chunked` framing parser.
 *
 * The parser is runtime independent and operates on `Uint8Array`, so that the
 * Node.js, web, and Blob adapters share identical framing and
 * malformed-response behaviour. Source bytes may be delivered in arbitrary
 * fragments: a size line, payload, delimiter, or trailer line may be split
 * across any number of writes.
 *
 * Only bytes from the `CHUNK_DATA` state are emitted. Framing bytes and trailer
 * bytes are consumed and never surface to the caller, so a checksum computed
 * over the emitted bytes covers exactly the decoded payload.
 *
 * @internal
 */
export class AwsChunkedParser {
  private state: AwsChunkedParserState = "CHUNK_SIZE";

  /**
   * Bytes buffered while locating a line boundary. Payload bytes are never
   * buffered here; they are emitted as slices of the incoming array.
   */
  private pending: Uint8Array = EMPTY;

  /**
   * Payload bytes still expected for the chunk being read.
   */
  private chunkRemaining = 0;

  private decodedByteCount = 0;
  private trailerSectionLength = 0;
  private trailerFieldCount = 0;

  private readonly parsedTrailers: Record<string, string> = Object.create(null);
  private readonly declaredTrailers: readonly string[];
  private readonly decodedContentLength?: number;

  public constructor({ declaredTrailers, decodedContentLength }: AwsChunkedParserOptions = {}) {
    this.declaredTrailers = (declaredTrailers ?? []).map((name) => name.trim().toLowerCase());
    this.decodedContentLength = decodedContentLength;

    if (decodedContentLength !== undefined && !Number.isSafeInteger(decodedContentLength)) {
      throw new AwsChunkedDecodeError(
        `declared decoded content length ${decodedContentLength} is not a safe non-negative integer.`
      );
    }
    if (decodedContentLength !== undefined && decodedContentLength < 0) {
      throw new AwsChunkedDecodeError(`declared decoded content length ${decodedContentLength} is negative.`);
    }
  }

  /**
   * Whether the terminal trailer section has been consumed.
   */
  public get complete(): boolean {
    return this.state === "COMPLETE";
  }

  /**
   * The parsed trailer fields, keyed by lowercased field name. Only meaningful
   * once {@link complete} is true.
   */
  public get trailers(): Record<string, string> {
    return this.parsedTrailers;
  }

  /**
   * The number of decoded payload bytes emitted so far.
   */
  public get decodedBytes(): number {
    return this.decodedByteCount;
  }

  /**
   * Consume source bytes, returning any decoded payload bytes they contained.
   *
   * @throws AwsChunkedDecodeError on malformed framing or a limit violation.
   */
  public write(bytes: Uint8Array): Uint8Array[] {
    const out: Uint8Array[] = [];
    let cursor = 0;

    while (cursor < bytes.byteLength) {
      if (this.state === "COMPLETE") {
        throw new AwsChunkedDecodeError("received data after the terminal trailer section.");
      }

      if (this.state === "CHUNK_DATA") {
        const available = bytes.byteLength - cursor;
        const take = Math.min(this.chunkRemaining, available);
        const payload = bytes.subarray(cursor, cursor + take);

        this.decodedByteCount += take;
        if (this.decodedContentLength !== undefined && this.decodedByteCount > this.decodedContentLength) {
          throw new AwsChunkedDecodeError(
            `decoded byte count exceeds the declared decoded content length of ${this.decodedContentLength}.`
          );
        }

        out.push(payload);
        cursor += take;
        this.chunkRemaining -= take;
        if (this.chunkRemaining === 0) {
          this.state = "CHUNK_DATA_CRLF";
        }
        continue;
      }

      const limit = this.state === "TRAILER_LINES" ? MAX_TRAILER_LINE_LENGTH : MAX_CHUNK_CONTROL_LINE_LENGTH;
      const line = this.takeLine(bytes, cursor, limit);
      if (line === null) {
        // The line is split across writes; the remainder is buffered.
        return out;
      }
      cursor = line.cursor;

      switch (this.state) {
        case "CHUNK_SIZE":
          this.onChunkSizeLine(line.content);
          break;
        case "CHUNK_DATA_CRLF":
          if (line.content.byteLength !== 0) {
            throw new AwsChunkedDecodeError("expected CRLF immediately after chunk data.");
          }
          this.state = "CHUNK_SIZE";
          break;
        case "TRAILER_LINES":
          this.onTrailerLine(line.content, line.consumed);
          break;
      }
    }

    return out;
  }

  /**
   * Signal that the source reached its end.
   *
   * @throws AwsChunkedDecodeError if the framing is truncated.
   */
  public end(): void {
    if (this.state !== "COMPLETE") {
      throw new AwsChunkedDecodeError(`source ended while in state ${this.state}; framing is truncated.`);
    }
  }

  /**
   * Validate source-wide invariants before exposing the framing as complete.
   */
  private completeFraming(): void {
    if (this.decodedContentLength !== undefined && this.decodedByteCount !== this.decodedContentLength) {
      throw new AwsChunkedDecodeError(
        `decoded byte count ${this.decodedByteCount} does not match the declared` +
          ` decoded content length of ${this.decodedContentLength}.`
      );
    }
    for (const name of this.declaredTrailers) {
      if (!(name in this.parsedTrailers)) {
        throw new AwsChunkedDecodeError(`declared trailer "${name}" was not present in the trailer section.`);
      }
    }
    this.state = "COMPLETE";
  }

  /**
   * Read up to and including the next CRLF, buffering across writes.
   *
   * Returns null when the delimiter has not arrived yet. The returned `content`
   * excludes the delimiter, while `consumed` counts it, so that limit
   * accounting includes delimiter bytes.
   */
  private takeLine(
    bytes: Uint8Array,
    cursor: number,
    limit: number
  ): { content: Uint8Array; consumed: number; cursor: number } | null {
    let lf = -1;
    for (let i = cursor; i < bytes.byteLength; ++i) {
      if (bytes[i] === LF) {
        lf = i;
        break;
      }
    }

    if (lf === -1) {
      const buffered = this.pending.byteLength + (bytes.byteLength - cursor);
      if (buffered > limit) {
        throw new AwsChunkedDecodeError(`control line exceeds the ${limit} byte limit.`);
      }
      this.pending = concat(this.pending, bytes.subarray(cursor));
      return null;
    }

    const consumed = this.pending.byteLength + (lf + 1 - cursor);
    if (consumed > limit) {
      throw new AwsChunkedDecodeError(`control line exceeds the ${limit} byte limit.`);
    }

    const raw = concat(this.pending, bytes.subarray(cursor, lf + 1));
    this.pending = EMPTY;

    if (raw.byteLength < 2 || raw[raw.byteLength - 2] !== CR) {
      throw new AwsChunkedDecodeError("expected CRLF line delimiter but found a bare LF.");
    }

    return {
      content: raw.subarray(0, raw.byteLength - 2),
      consumed,
      cursor: lf + 1,
    };
  }

  private onChunkSizeLine(content: Uint8Array): void {
    // Chunk extensions are permitted and ignored. They still count toward the
    // control line limit because the whole line is measured.
    let end = content.byteLength;
    for (let i = 0; i < content.byteLength; ++i) {
      if (content[i] === SEMICOLON) {
        end = i;
        break;
      }
    }

    if (end === 0) {
      throw new AwsChunkedDecodeError("chunk size line is missing its hexadecimal size.");
    }
    for (let i = 0; i < end; ++i) {
      if (!isHexDigit(content[i])) {
        throw new AwsChunkedDecodeError(`chunk size line contains a non-hexadecimal byte: "${toAscii(content)}".`);
      }
    }

    const size = Number.parseInt(toAscii(content.subarray(0, end)), 16);
    if (!Number.isSafeInteger(size)) {
      throw new AwsChunkedDecodeError(`chunk size exceeds the maximum safe integer: "${toAscii(content)}".`);
    }

    if (size === 0) {
      // The zero-sized chunk is the transition to trailers, not payload.
      this.state = "TRAILER_LINES";
      return;
    }
    this.chunkRemaining = size;
    this.state = "CHUNK_DATA";
  }

  private onTrailerLine(content: Uint8Array, consumed: number): void {
    this.trailerSectionLength += consumed;
    if (this.trailerSectionLength > MAX_TRAILER_SECTION_LENGTH) {
      throw new AwsChunkedDecodeError(`trailer section exceeds the ${MAX_TRAILER_SECTION_LENGTH} byte limit.`);
    }

    if (content.byteLength === 0) {
      this.completeFraming();
      return;
    }

    let colon = -1;
    for (let i = 0; i < content.byteLength; ++i) {
      if (content[i] === COLON) {
        colon = i;
        break;
      }
    }
    if (colon <= 0) {
      throw new AwsChunkedDecodeError(`trailer line is not a "name:value" pair: "${toAscii(content)}".`);
    }

    if (++this.trailerFieldCount > MAX_TRAILER_FIELD_COUNT) {
      throw new AwsChunkedDecodeError(`trailer section exceeds the ${MAX_TRAILER_FIELD_COUNT} field limit.`);
    }

    // Field names are case-insensitive. Values keep their bytes, less the
    // optional surrounding whitespace that HTTP permits.
    const name = toAscii(content.subarray(0, colon)).trim().toLowerCase();
    const value = toAscii(content.subarray(colon + 1)).trim();

    if (name.length === 0) {
      throw new AwsChunkedDecodeError("trailer line has an empty field name.");
    }
    if (name in this.parsedTrailers && this.parsedTrailers[name] !== value) {
      throw new AwsChunkedDecodeError(`trailer "${name}" was repeated with a conflicting value.`);
    }

    this.parsedTrailers[name] = value;
  }
}
