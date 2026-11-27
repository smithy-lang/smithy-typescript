import { AwsChunkedDecodeError } from "./AwsChunkedDecodeError";
import type { TrailerField } from "./types";

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

const HTAB = 0x09;
const SP = 0x20;
const DQUOTE = 0x22;
const COLON = 0x3a;
const SEMICOLON = 0x3b;
const EQUALS = 0x3d;
const BACKSLASH = 0x5c;
const CR = 0x0d;
const LF = 0x0a;

const EMPTY = new Uint8Array(0);

/**
 * @internal
 */
export type AwsChunkedParserState =
  | "CHUNK_SIZE"
  | "CHUNK_DATA"
  | "CHUNK_DATA_CRLF"
  | "TRAILER_LINES"
  | "AWAIT_EOF"
  | "COMPLETE";

/**
 * @internal
 */
export interface AwsChunkedParserOptions {
  /**
   * Trailer field names declared by the response. Every trailer field that
   * arrives must have a matching declaration. Compared case-insensitively.
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
 * Decode control bytes without pulling in a UTF-8 decoder. HTTP field values
 * can contain obs-text, so this intentionally preserves each octet as the
 * corresponding code point.
 */
const toByteString = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.byteLength; ++i) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
};

const isHexDigit = (code: number): boolean =>
  (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);

const isOws = (code: number): boolean => code === SP || code === HTAB;

/** RFC 9110 tchar. */
const isTokenCharacter = (code: number): boolean =>
  (code >= 0x30 && code <= 0x39) ||
  (code >= 0x41 && code <= 0x5a) ||
  (code >= 0x61 && code <= 0x7a) ||
  code === 0x21 ||
  code === 0x23 ||
  code === 0x24 ||
  code === 0x25 ||
  code === 0x26 ||
  code === 0x27 ||
  code === 0x2a ||
  code === 0x2b ||
  code === 0x2d ||
  code === 0x2e ||
  code === 0x5e ||
  code === 0x5f ||
  code === 0x60 ||
  code === 0x7c ||
  code === 0x7e;

/** RFC 9110 qdtext. */
const isQuotedText = (code: number): boolean =>
  code === HTAB ||
  code === SP ||
  code === 0x21 ||
  (code >= 0x23 && code <= 0x5b) ||
  (code >= 0x5d && code <= 0x7e) ||
  code >= 0x80;

/** RFC 9110 quoted-pair payload. */
const isQuotedPairCharacter = (code: number): boolean =>
  code === HTAB || code === SP || (code >= 0x21 && code <= 0x7e) || code >= 0x80;

/** HTTP field-vchar plus SP and HTAB. */
const isFieldValueCharacter = (code: number): boolean => code === HTAB || (code >= SP && code <= 0x7e) || code >= 0x80;

const trimOws = (value: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && isOws(value.charCodeAt(start))) {
    ++start;
  }
  while (end > start && isOws(value.charCodeAt(end - 1))) {
    --end;
  }
  return value.slice(start, end);
};

/**
 * A single-pass `aws-chunked` framing parser.
 *
 * The parser is runtime independent and operates on `Uint8Array`, so that the
 * Node.js, web, and Blob adapters share identical framing and
 * malformed-response behaviour. Source bytes may be delivered in arbitrary
 * fragments: a size line, extension, payload, delimiter, or trailer line may
 * be split across any number of writes.
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

  /** Payload bytes still expected for the chunk being read. */
  private chunkRemaining = 0;

  private decodedByteCount = 0;
  private trailerSectionLength = 0;
  private trailerFieldCount = 0;

  private readonly parsedTrailers: TrailerField[] = [];
  private readonly declaredTrailers: ReadonlySet<string>;
  private readonly decodedContentLength?: number;

  public constructor({ declaredTrailers, decodedContentLength }: AwsChunkedParserOptions = {}) {
    this.declaredTrailers = new Set((declaredTrailers ?? []).map((name) => trimOws(name).toLowerCase()));
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

  /** Whether the terminal trailer section has been consumed. */
  public get complete(): boolean {
    return this.state === "COMPLETE";
  }

  /**
   * Parsed trailer fields in wire order, preserving original name spelling and
   * duplicates. Only meaningful once {@link complete} is true.
   */
  public get trailers(): readonly TrailerField[] {
    return this.parsedTrailers;
  }

  /** The number of decoded payload bytes emitted so far. */
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
      if (this.state === "COMPLETE" || this.state === "AWAIT_EOF") {
        throw new AwsChunkedDecodeError("received data after the terminal trailer section.");
      }

      if (this.state === "CHUNK_DATA") {
        const available = bytes.byteLength - cursor;
        const take = Math.min(this.chunkRemaining, available);
        const payload = bytes.subarray(cursor, cursor + take);

        if (take > Number.MAX_SAFE_INTEGER - this.decodedByteCount) {
          throw new AwsChunkedDecodeError("cumulative decoded byte count exceeds the maximum safe integer.");
        }
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

      const trailerLine = this.state === "TRAILER_LINES";
      const limit = trailerLine ? MAX_TRAILER_LINE_LENGTH : MAX_CHUNK_CONTROL_LINE_LENGTH;
      const line = this.takeLine(bytes, cursor, limit, trailerLine);
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
    if (this.state === "AWAIT_EOF") {
      this.completeFraming();
      return;
    }
    if (this.state !== "COMPLETE") {
      throw new AwsChunkedDecodeError(`source ended while in state ${this.state}; framing is truncated.`);
    }
  }

  /** Validate source-wide invariants before exposing the framing as complete. */
  private completeFraming(): void {
    if (this.decodedContentLength !== undefined && this.decodedByteCount !== this.decodedContentLength) {
      throw new AwsChunkedDecodeError(
        `decoded byte count ${this.decodedByteCount} does not match the declared` +
          ` decoded content length of ${this.decodedContentLength}.`
      );
    }
    this.state = "COMPLETE";
  }

  /**
   * Read up to and including the next CRLF, buffering across writes.
   *
   * Returns null when the delimiter has not arrived yet. The returned `content`
   * excludes the delimiter, while `consumed` counts it, so limit accounting
   * includes delimiter bytes.
   */
  private takeLine(
    bytes: Uint8Array,
    cursor: number,
    limit: number,
    trailerLine: boolean
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
      this.assertLineLimits(buffered, limit, trailerLine);
      this.pending = concat(this.pending, bytes.subarray(cursor));
      return null;
    }

    const consumed = this.pending.byteLength + (lf + 1 - cursor);
    this.assertLineLimits(consumed, limit, trailerLine);

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

  /** Enforce line and aggregate limits before buffering additional bytes. */
  private assertLineLimits(length: number, limit: number, trailerLine: boolean): void {
    if (length > limit) {
      const kind = trailerLine ? "trailer" : "control";
      throw new AwsChunkedDecodeError(`${kind} line exceeds the ${limit} byte limit.`);
    }
    if (trailerLine && length > MAX_TRAILER_SECTION_LENGTH - this.trailerSectionLength) {
      throw new AwsChunkedDecodeError(`trailer section exceeds the ${MAX_TRAILER_SECTION_LENGTH} byte limit.`);
    }
  }

  private onChunkSizeLine(content: Uint8Array): void {
    let cursor = 0;
    while (cursor < content.byteLength && isHexDigit(content[cursor])) {
      ++cursor;
    }
    if (cursor === 0) {
      throw new AwsChunkedDecodeError("chunk size line is missing its hexadecimal size.");
    }

    const sizeTokenEnd = cursor;
    this.validateChunkExtensions(content, cursor);

    const size = Number.parseInt(toByteString(content.subarray(0, sizeTokenEnd)), 16);
    if (!Number.isSafeInteger(size)) {
      throw new AwsChunkedDecodeError(`chunk size exceeds the maximum safe integer: "${toByteString(content)}".`);
    }

    if (size === 0) {
      // The zero-sized chunk is the transition to trailers, not payload.
      this.state = "TRAILER_LINES";
      return;
    }
    this.chunkRemaining = size;
    this.state = "CHUNK_DATA";
  }

  /** Validate RFC 9112 chunk extensions while intentionally ignoring semantics. */
  private validateChunkExtensions(content: Uint8Array, start: number): void {
    let cursor = start;
    while (cursor < content.byteLength) {
      const bwsStart = cursor;
      cursor = this.skipOws(content, cursor);
      if (cursor === content.byteLength) {
        throw new AwsChunkedDecodeError(
          bwsStart === cursor
            ? "chunk size line contains an invalid byte after its hexadecimal size."
            : "chunk size line has trailing whitespace not followed by an extension."
        );
      }
      if (content[cursor] !== SEMICOLON) {
        throw new AwsChunkedDecodeError("chunk extension must begin with a semicolon.");
      }
      ++cursor;
      cursor = this.skipOws(content, cursor);

      const nameStart = cursor;
      while (cursor < content.byteLength && isTokenCharacter(content[cursor])) {
        ++cursor;
      }
      if (cursor === nameStart) {
        throw new AwsChunkedDecodeError("chunk extension has an empty or invalid name.");
      }

      const valueBwsStart = cursor;
      cursor = this.skipOws(content, cursor);
      if (cursor === content.byteLength && cursor !== valueBwsStart) {
        throw new AwsChunkedDecodeError("chunk extension has trailing whitespace not followed by another extension.");
      }
      if (cursor < content.byteLength && content[cursor] === EQUALS) {
        ++cursor;
        cursor = this.skipOws(content, cursor);
        if (cursor === content.byteLength) {
          throw new AwsChunkedDecodeError("chunk extension is missing its value.");
        }

        if (content[cursor] === DQUOTE) {
          cursor = this.consumeQuotedString(content, cursor + 1);
        } else {
          const valueStart = cursor;
          while (cursor < content.byteLength && isTokenCharacter(content[cursor])) {
            ++cursor;
          }
          if (cursor === valueStart) {
            throw new AwsChunkedDecodeError("chunk extension has an invalid token value.");
          }
        }
      }
    }
  }

  private skipOws(content: Uint8Array, start: number): number {
    let cursor = start;
    while (cursor < content.byteLength && isOws(content[cursor])) {
      ++cursor;
    }
    return cursor;
  }

  /** Consume a quoted-string after its opening quote and return the next index. */
  private consumeQuotedString(content: Uint8Array, start: number): number {
    let cursor = start;
    while (cursor < content.byteLength) {
      const code = content[cursor++];
      if (code === DQUOTE) {
        return cursor;
      }
      if (code === BACKSLASH) {
        if (cursor === content.byteLength || !isQuotedPairCharacter(content[cursor])) {
          throw new AwsChunkedDecodeError("chunk extension contains an invalid quoted-string escape.");
        }
        ++cursor;
        continue;
      }
      if (!isQuotedText(code)) {
        throw new AwsChunkedDecodeError("chunk extension contains an invalid quoted-string byte.");
      }
    }
    throw new AwsChunkedDecodeError("chunk extension contains an unterminated quoted string.");
  }

  private onTrailerLine(content: Uint8Array, consumed: number): void {
    this.trailerSectionLength += consumed;

    if (content.byteLength === 0) {
      this.state = "AWAIT_EOF";
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
      throw new AwsChunkedDecodeError(`trailer line is not a "name:value" pair: "${toByteString(content)}".`);
    }
    for (let i = 0; i < colon; ++i) {
      if (!isTokenCharacter(content[i])) {
        throw new AwsChunkedDecodeError("trailer field name contains an invalid byte or whitespace before the colon.");
      }
    }
    for (let i = colon + 1; i < content.byteLength; ++i) {
      if (!isFieldValueCharacter(content[i])) {
        throw new AwsChunkedDecodeError("trailer field value contains a prohibited control character.");
      }
    }

    if (++this.trailerFieldCount > MAX_TRAILER_FIELD_COUNT) {
      throw new AwsChunkedDecodeError(`trailer section exceeds the ${MAX_TRAILER_FIELD_COUNT} field limit.`);
    }

    const name = toByteString(content.subarray(0, colon));
    const normalizedName = name.toLowerCase();
    if (!this.declaredTrailers.has(normalizedName)) {
      throw new AwsChunkedDecodeError(`trailer "${name}" was not declared by the response.`);
    }

    const value = trimOws(toByteString(content.subarray(colon + 1)));
    this.parsedTrailers.push({ name, value });
  }
}
