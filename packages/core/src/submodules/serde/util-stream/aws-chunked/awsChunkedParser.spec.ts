import { describe, expect, test as it } from "vitest";

import { fromUtf8 } from "../../util-utf8/fromUtf8";
import { toUtf8 } from "../../util-utf8/toUtf8";
import { AwsChunkedDecodeError } from "./AwsChunkedDecodeError";
import {
  AwsChunkedParser,
  MAX_CHUNK_CONTROL_LINE_LENGTH,
  MAX_TRAILER_FIELD_COUNT,
  MAX_TRAILER_LINE_LENGTH,
  MAX_TRAILER_SECTION_LENGTH,
} from "./awsChunkedParser";

describe(AwsChunkedParser.name, () => {
  /**
   * Frame a payload as a single aws-chunked chunk with an optional trailer
   * section, matching what the upload-side encoder produces.
   */
  const frame = (payload: string, trailers: Record<string, string> = {}): string => {
    const chunk = payload.length > 0 ? `${payload.length.toString(16)}\r\n${payload}\r\n` : "";
    const trailerLines = Object.entries(trailers)
      .map(([name, value]) => `${name}:${value}\r\n`)
      .join("");
    return `${chunk}0\r\n${trailerLines}\r\n`;
  };

  /**
   * Feed an encoded body to the parser in fragments of the given size and
   * return the concatenated decoded payload.
   */
  const decode = (encoded: string, splitSize: number, parser = new AwsChunkedParser()): string => {
    const bytes = fromUtf8(encoded);
    const out: number[] = [];
    for (let i = 0; i < bytes.byteLength; i += splitSize) {
      for (const payload of parser.write(bytes.subarray(i, Math.min(i + splitSize, bytes.byteLength)))) {
        out.push(...payload);
      }
    }
    parser.end();
    return toUtf8(new Uint8Array(out));
  };

  const alphabet = "abcdefghijklmnopqrstuvwxyz";

  describe("framing", () => {
    it("should decode a single chunk", () => {
      expect(decode(frame(alphabet), Infinity)).toEqual(alphabet);
    });

    it("should decode multiple chunks", () => {
      const encoded = `3\r\nabc\r\n3\r\ndef\r\n1\r\ng\r\n0\r\n\r\n`;
      expect(decode(encoded, Infinity)).toEqual("abcdefg");
    });

    it("should decode an empty payload", () => {
      expect(decode(`0\r\n\r\n`, Infinity)).toEqual("");
    });

    it("should not emit the zero-sized chunk as payload", () => {
      const parser = new AwsChunkedParser();
      const emitted = parser.write(fromUtf8(`0\r\n\r\n`));
      expect(emitted.reduce((n, c) => n + c.byteLength, 0)).toEqual(0);
      expect(parser.complete).toBe(true);
    });

    it("should accept uppercase hexadecimal chunk sizes", () => {
      // 0x1A is the 26-byte alphabet.
      expect(decode(`1A\r\n${alphabet}\r\n0\r\n\r\n`, Infinity)).toEqual(alphabet);
    });

    it("should accept and ignore chunk extensions", () => {
      expect(decode(`3;foo=bar\r\nabc\r\n0\r\n\r\n`, Infinity)).toEqual("abc");
    });

    it("should count decoded bytes", () => {
      const parser = new AwsChunkedParser();
      decode(frame(alphabet), 4, parser);
      expect(parser.decodedBytes).toEqual(26);
    });
  });

  describe("source split patterns", () => {
    const encoded = frame(alphabet, {
      "x-amz-stream-checksum-crc32": "AAAAAA==",
      "x-amz-other": "value",
    });

    for (const splitSize of [1, 2, 3, 7, 16, Infinity]) {
      it(`should decode identically with ${splitSize} bytes per source chunk`, () => {
        const parser = new AwsChunkedParser({
          declaredTrailers: ["x-amz-stream-checksum-crc32"],
          decodedContentLength: 26,
        });
        expect(decode(encoded, splitSize, parser)).toEqual(alphabet);
        expect(parser.trailers).toEqual({
          "x-amz-stream-checksum-crc32": "AAAAAA==",
          "x-amz-other": "value",
        });
      });
    }

    it("should report the same error regardless of where a malformed body is split", () => {
      const malformed = `3\r\nabc\r\nZZ\r\n0\r\n\r\n`;
      for (const splitSize of [1, 2, 5, Infinity]) {
        expect(() => decode(malformed, splitSize)).toThrow(AwsChunkedDecodeError);
      }
    });

    it("should handle a split inside every byte position of a valid body", () => {
      const bytes = fromUtf8(encoded);
      for (let cut = 1; cut < bytes.byteLength; ++cut) {
        const parser = new AwsChunkedParser();
        const out: number[] = [];
        for (const part of [bytes.subarray(0, cut), bytes.subarray(cut)]) {
          for (const payload of parser.write(part)) {
            out.push(...payload);
          }
        }
        parser.end();
        expect(toUtf8(new Uint8Array(out))).toEqual(alphabet);
      }
    });
  });

  describe("trailers", () => {
    it("should parse field names case-insensitively and preserve values", () => {
      const parser = new AwsChunkedParser();
      decode(`0\r\nX-Amz-Checksum-CRC32:AbC/dEf=\r\n\r\n`, Infinity, parser);
      expect(parser.trailers).toEqual({ "x-amz-checksum-crc32": "AbC/dEf=" });
    });

    it("should trim optional whitespace around values", () => {
      const parser = new AwsChunkedParser();
      decode(`0\r\nx-amz-trailer:  spaced  \r\n\r\n`, Infinity, parser);
      expect(parser.trailers).toEqual({ "x-amz-trailer": "spaced" });
    });

    it("should accept an empty trailer value", () => {
      // An empty value is valid framing. It becomes a mismatch when compared.
      const parser = new AwsChunkedParser({ declaredTrailers: ["x-amz-checksum-crc32"] });
      decode(`0\r\nx-amz-checksum-crc32:\r\n\r\n`, Infinity, parser);
      expect(parser.trailers).toEqual({ "x-amz-checksum-crc32": "" });
    });

    it("should accept a repeated trailer with an identical value", () => {
      const parser = new AwsChunkedParser();
      decode(`0\r\na:1\r\na:1\r\n\r\n`, Infinity, parser);
      expect(parser.trailers).toEqual({ a: "1" });
    });

    it("should reject a repeated trailer with a conflicting value", () => {
      expect(() => decode(`0\r\na:1\r\na:2\r\n\r\n`, Infinity)).toThrow(/repeated with a conflicting value/);
    });

    it("should reject a declared trailer that never arrives", () => {
      const parser = new AwsChunkedParser({ declaredTrailers: ["x-amz-checksum-crc32"] });
      expect(() => decode(`0\r\nx-amz-other:1\r\n\r\n`, Infinity, parser)).toThrow(
        /declared trailer "x-amz-checksum-crc32" was not present/
      );
    });

    it("should match declared trailers case-insensitively", () => {
      const parser = new AwsChunkedParser({ declaredTrailers: ["X-Amz-Checksum-CRC32"] });
      expect(decode(`0\r\nx-amz-checksum-crc32:v\r\n\r\n`, Infinity, parser)).toEqual("");
    });

    it("should reject a trailer line without a colon", () => {
      expect(() => decode(`0\r\nnot-a-pair\r\n\r\n`, Infinity)).toThrow(/not a "name:value" pair/);
    });

    it("should reject a trailer line with an empty field name", () => {
      expect(() => decode(`0\r\n:value\r\n\r\n`, Infinity)).toThrow(/not a "name:value" pair/);
    });
  });

  describe("malformed framing", () => {
    it("should reject a non-hexadecimal chunk size", () => {
      expect(() => decode(`zz\r\nabc\r\n0\r\n\r\n`, Infinity)).toThrow(/non-hexadecimal byte/);
    });

    it("should reject an empty chunk size", () => {
      expect(() => decode(`\r\nabc\r\n0\r\n\r\n`, Infinity)).toThrow(/missing its hexadecimal size/);
    });

    it("should reject a chunk size above the maximum safe integer", () => {
      expect(() => decode(`20000000000000\r\n`, Infinity)).toThrow(/exceeds the maximum safe integer/);
    });

    it("should accept a chunk size at the maximum safe integer boundary", () => {
      // 0x1fffffffffffff is Number.MAX_SAFE_INTEGER; the body is truncated, so
      // the size itself must be what is accepted before the truncation error.
      expect(() => decode(`1fffffffffffff\r\nabc`, Infinity)).toThrow(/framing is truncated/);
    });

    it("should reject a bare LF line delimiter", () => {
      expect(() => decode(`3\nabc\r\n0\r\n\r\n`, Infinity)).toThrow(/bare LF/);
    });

    it("should reject data that is not followed by CRLF", () => {
      expect(() => decode(`3\r\nabcXX\r\n0\r\n\r\n`, Infinity)).toThrow(/expected CRLF immediately after chunk data/);
    });

    it("should reject a truncated body", () => {
      expect(() => decode(`3\r\nab`, Infinity)).toThrow(/framing is truncated/);
    });

    it("should reject a missing trailer terminator", () => {
      // The upload-side encoder emits "0\r\n" with no terminating blank line
      // when there is no checksum, which this rejects as truncated.
      expect(() => decode(`3\r\nabc\r\n0\r\n`, Infinity)).toThrow(/framing is truncated/);
    });

    it("should reject bytes after the terminal trailer section", () => {
      expect(() => decode(`0\r\n\r\nextra`, Infinity)).toThrow(/data after the terminal trailer section/);
    });

    it("should reject a premature end in the middle of the trailer section", () => {
      expect(() => decode(`0\r\na:1\r\n`, Infinity)).toThrow(/framing is truncated/);
    });
  });

  describe("decoded content length", () => {
    it("should accept a matching declared length", () => {
      const parser = new AwsChunkedParser({ decodedContentLength: 26 });
      expect(decode(frame(alphabet), 3, parser)).toEqual(alphabet);
    });

    it("should reject a declared length that is too small", () => {
      const parser = new AwsChunkedParser({ decodedContentLength: 10 });
      expect(() => decode(frame(alphabet), Infinity, parser)).toThrow(/exceeds the declared decoded content length/);
    });

    it("should reject a declared length that is too large", () => {
      const parser = new AwsChunkedParser({ decodedContentLength: 100 });
      expect(() => decode(frame(alphabet), Infinity, parser)).toThrow(/does not match the declared/);
    });

    it("should accept a declared length of zero for an empty payload", () => {
      const parser = new AwsChunkedParser({ decodedContentLength: 0 });
      expect(decode(`0\r\n\r\n`, Infinity, parser)).toEqual("");
    });

    it("should reject a negative declared length at construction", () => {
      expect(() => new AwsChunkedParser({ decodedContentLength: -1 })).toThrow(/is negative/);
    });

    it("should reject a non-integer declared length at construction", () => {
      expect(() => new AwsChunkedParser({ decodedContentLength: 1.5 })).toThrow(/not a safe non-negative integer/);
    });

    it("should reject a declared length above the maximum safe integer", () => {
      expect(() => new AwsChunkedParser({ decodedContentLength: Number.MAX_SAFE_INTEGER + 2 })).toThrow(
        /not a safe non-negative integer/
      );
    });
  });

  describe("resource limits", () => {
    it("should accept a control line at the limit", () => {
      // Pad with chunk extension bytes so the line reaches exactly the limit.
      const padding = "x".repeat(MAX_CHUNK_CONTROL_LINE_LENGTH - "3;".length - "\r\n".length);
      expect(decode(`3;${padding}\r\nabc\r\n0\r\n\r\n`, Infinity)).toEqual("abc");
    });

    it("should reject a control line one byte over the limit", () => {
      const padding = "x".repeat(MAX_CHUNK_CONTROL_LINE_LENGTH - "3;".length - "\r\n".length + 1);
      expect(() => decode(`3;${padding}\r\nabc\r\n0\r\n\r\n`, Infinity)).toThrow(
        new RegExp(`control line exceeds the ${MAX_CHUNK_CONTROL_LINE_LENGTH} byte limit`)
      );
    });

    it("should accept a trailer line at the limit", () => {
      const value = "v".repeat(MAX_TRAILER_LINE_LENGTH - "a:".length - "\r\n".length);
      const parser = new AwsChunkedParser();
      decode(`0\r\na:${value}\r\n\r\n`, Infinity, parser);
      expect(parser.trailers.a).toHaveLength(value.length);
    });

    it("should reject a trailer line one byte over the limit", () => {
      const value = "v".repeat(MAX_TRAILER_LINE_LENGTH - "a:".length - "\r\n".length + 1);
      expect(() => decode(`0\r\na:${value}\r\n\r\n`, Infinity)).toThrow(
        new RegExp(`control line exceeds the ${MAX_TRAILER_LINE_LENGTH} byte limit`)
      );
    });

    it("should reject a trailer section over the aggregate limit", () => {
      // Each line is under the per-line limit but together they exceed 64 KiB.
      const value = "v".repeat(4 * 1024);
      let lines = "";
      for (let i = 0; i < 20; ++i) {
        lines += `field-${i}:${value}\r\n`;
      }
      expect(() => decode(`0\r\n${lines}\r\n`, Infinity)).toThrow(
        new RegExp(`trailer section exceeds the ${MAX_TRAILER_SECTION_LENGTH} byte limit`)
      );
    });

    it("should accept the maximum number of trailer fields", () => {
      let lines = "";
      for (let i = 0; i < MAX_TRAILER_FIELD_COUNT; ++i) {
        lines += `field-${i}:v\r\n`;
      }
      const parser = new AwsChunkedParser();
      decode(`0\r\n${lines}\r\n`, Infinity, parser);
      expect(Object.keys(parser.trailers)).toHaveLength(MAX_TRAILER_FIELD_COUNT);
    });

    it("should reject one trailer field over the limit", () => {
      let lines = "";
      for (let i = 0; i < MAX_TRAILER_FIELD_COUNT + 1; ++i) {
        lines += `field-${i}:v\r\n`;
      }
      expect(() => decode(`0\r\n${lines}\r\n`, Infinity)).toThrow(
        new RegExp(`trailer section exceeds the ${MAX_TRAILER_FIELD_COUNT} field limit`)
      );
    });

    it("should enforce the control line limit across writes", () => {
      const parser = new AwsChunkedParser();
      const filler = fromUtf8("x".repeat(1024));
      expect(() => {
        // No delimiter ever arrives, so the buffered line grows past the limit.
        for (let i = 0; i < 16; ++i) {
          parser.write(filler);
        }
      }).toThrow(/control line exceeds/);
    });
  });

  describe("error type", () => {
    it("should throw AwsChunkedDecodeError with a stable code", () => {
      try {
        decode(`zz\r\n`, Infinity);
        throw new Error("expected a decode error");
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(AwsChunkedDecodeError);
        expect((e as AwsChunkedDecodeError).name).toEqual("AwsChunkedDecodeError");
        expect((e as AwsChunkedDecodeError).code).toEqual("AWS_CHUNKED_MALFORMED");
      }
    });
  });
});
