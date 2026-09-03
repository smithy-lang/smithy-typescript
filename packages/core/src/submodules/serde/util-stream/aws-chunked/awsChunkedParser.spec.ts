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
import type { TrailerField } from "./types";

describe(AwsChunkedParser.name, () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";

  const frame = (payload: string, trailers: readonly TrailerField[] = []): string => {
    const chunk = payload.length > 0 ? `${payload.length.toString(16)}\r\n${payload}\r\n` : "";
    const trailerLines = trailers.map(({ name, value }) => `${name}:${value}\r\n`).join("");
    return `${chunk}0\r\n${trailerLines}\r\n`;
  };

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

  describe("accepted response vectors", () => {
    const vectors: Array<{
      name: string;
      encoded: string;
      payload: string;
      declarations?: string[];
      trailers?: TrailerField[];
    }> = [
      {
        name: "single chunk",
        encoded: `3\r\nabc\r\n0\r\n\r\n`,
        payload: "abc",
      },
      {
        name: "multiple chunks",
        encoded: `3\r\nabc\r\n3\r\ndef\r\n1\r\ng\r\n0\r\n\r\n`,
        payload: "abcdefg",
      },
      {
        name: "CRLF in payload",
        encoded: `4\r\na\r\nb\r\n0\r\n\r\n`,
        payload: "a\r\nb",
      },
      {
        name: "empty payload",
        encoded: `000;terminal=ok\r\n\r\n`,
        payload: "",
      },
      {
        name: "mixed-case and leading-zero hexadecimal",
        encoded: `000A\r\n0123456789\r\n0\r\n\r\n`,
        payload: "0123456789",
      },
      {
        name: "data and terminal extensions",
        encoded: `3 \t; repeated ; repeated = token ; quoted = "a\\"b\\\\c"\r\nabc\r\n0; end = "yes"\r\n\r\n`,
        payload: "abc",
      },
      {
        name: "ordered duplicate trailers",
        encoded: `0\r\nX-First:  one  \r\nx-duplicate:two\r\nX-Duplicate:\tthree\t\r\n\r\n`,
        payload: "",
        declarations: ["x-first", "x-duplicate"],
        trailers: [
          { name: "X-First", value: "one" },
          { name: "x-duplicate", value: "two" },
          { name: "X-Duplicate", value: "three" },
        ],
      },
    ];

    for (const vector of vectors) {
      for (const splitSize of [1, 2, Infinity]) {
        it(`should decode ${vector.name} with source chunks of ${splitSize} byte(s)`, () => {
          const parser = new AwsChunkedParser({ declaredTrailers: vector.declarations });
          expect(decode(vector.encoded, splitSize, parser)).toEqual(vector.payload);
          expect(parser.trailers).toEqual(vector.trailers ?? []);
        });
      }
    }

    it("should handle a split at every byte position", () => {
      const encoded = frame(alphabet, [
        { name: "x-amz-stream-checksum-crc32", value: "AAAAAA==" },
        { name: "x-amz-other", value: "value" },
      ]);
      const bytes = fromUtf8(encoded);
      for (let cut = 1; cut < bytes.byteLength; ++cut) {
        const parser = new AwsChunkedParser({
          declaredTrailers: ["x-amz-stream-checksum-crc32", "x-amz-other"],
          decodedContentLength: alphabet.length,
        });
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

  describe("chunk-size and extension grammar", () => {
    it.each([
      ["empty", `\r\n`],
      ["signed", `+3\r\n`],
      ["negative", `-3\r\n`],
      ["0x-prefixed", `0x3\r\n`],
      ["partial hexadecimal", `3g\r\n`],
      ["non-ASCII", `３\r\n`],
      ["whitespace without extension", `3 \r\n`],
    ])("should reject a %s chunk size", (_name, line) => {
      expect(() => decode(`${line}abc\r\n0\r\n\r\n`, Infinity)).toThrow(AwsChunkedDecodeError);
    });

    it.each([
      ["empty name", `3;\r\nabc\r\n0\r\n\r\n`],
      ["empty name after BWS", `3 ; \t=foo\r\nabc\r\n0\r\n\r\n`],
      ["invalid name", `3;foo/bar\r\nabc\r\n0\r\n\r\n`],
      ["missing value", `3;foo=\r\nabc\r\n0\r\n\r\n`],
      ["invalid token value", `3;foo=(bar)\r\nabc\r\n0\r\n\r\n`],
      ["unterminated quote", `3;foo="bar\r\nabc\r\n0\r\n\r\n`],
      ["invalid escape", `3;foo="bar\\\u0001"\r\nabc\r\n0\r\n\r\n`],
      ["raw control", `3;foo="bar\u0001"\r\nabc\r\n0\r\n\r\n`],
      ["trailing BWS", `3;foo \r\nabc\r\n0\r\n\r\n`],
    ])("should reject an extension with %s", (_name, encoded) => {
      expect(() => decode(encoded, Infinity)).toThrow(AwsChunkedDecodeError);
    });

    it("should accept a chunk size at Number.MAX_SAFE_INTEGER", () => {
      expect(() => decode(`1fffffffffffff\r\nabc`, Infinity)).toThrow(/framing is truncated/);
    });

    it("should reject a chunk size above Number.MAX_SAFE_INTEGER", () => {
      expect(() => decode(`20000000000000\r\n`, Infinity)).toThrow(/exceeds the maximum safe integer/);
    });
  });

  describe("trailer field grammar", () => {
    it("should trim only surrounding SP and HTAB and preserve internal whitespace and colons", () => {
      const parser = new AwsChunkedParser({ declaredTrailers: ["x-value"] });
      decode(`0\r\nX-Value:\t  first:\tsecond  \t\r\n\r\n`, Infinity, parser);
      expect(parser.trailers).toEqual([{ name: "X-Value", value: "first:\tsecond" }]);
    });

    it("should accept an empty trailer value", () => {
      const parser = new AwsChunkedParser({ declaredTrailers: ["x-amz-checksum-crc32"] });
      decode(`0\r\nx-amz-checksum-crc32:\r\n\r\n`, Infinity, parser);
      expect(parser.trailers).toEqual([{ name: "x-amz-checksum-crc32", value: "" }]);
    });

    it("should preserve duplicate fields even when values differ", () => {
      const parser = new AwsChunkedParser({ declaredTrailers: ["a"] });
      decode(`0\r\na:1\r\nA:2\r\na:1\r\n\r\n`, Infinity, parser);
      expect(parser.trailers).toEqual([
        { name: "a", value: "1" },
        { name: "A", value: "2" },
        { name: "a", value: "1" },
      ]);
    });

    it("should allow a declared generic trailer to be absent", () => {
      const parser = new AwsChunkedParser({ declaredTrailers: ["x-optional"] });
      expect(decode(`0\r\n\r\n`, Infinity, parser)).toEqual("");
    });

    it("should match declarations case-insensitively", () => {
      const parser = new AwsChunkedParser({ declaredTrailers: ["X-Amz-Checksum-CRC32"] });
      expect(decode(`0\r\nx-amz-checksum-crc32:v\r\n\r\n`, Infinity, parser)).toEqual("");
    });

    it("should reject an undeclared actual trailer", () => {
      const parser = new AwsChunkedParser({ declaredTrailers: ["x-declared"] });
      expect(() => decode(`0\r\nx-other:value\r\n\r\n`, Infinity, parser)).toThrow(/was not declared/);
    });

    it.each([
      ["missing colon", `not-a-pair`],
      ["empty name", `:value`],
      ["whitespace before colon", `name :value`],
      ["invalid name", `bad(name):value`],
      ["obs-fold", ` continuation:value`],
      ["control in value", `name:bad\u0001value`],
      ["DEL in value", `name:bad\u007fvalue`],
    ])("should reject a trailer with %s", (_name, line) => {
      const parser = new AwsChunkedParser({ declaredTrailers: ["name", "bad(name)", "continuation"] });
      expect(() => decode(`0\r\n${line}\r\n\r\n`, Infinity, parser)).toThrow(AwsChunkedDecodeError);
    });
  });

  describe("terminal framing and source EOF", () => {
    it("should not emit the zero-sized chunk as payload", () => {
      const parser = new AwsChunkedParser();
      const emitted = parser.write(fromUtf8(`0\r\n\r\n`));
      expect(emitted.reduce((n, chunk) => n + chunk.byteLength, 0)).toEqual(0);
      expect(parser.complete).toBe(false);
      parser.end();
      expect(parser.complete).toBe(true);
    });

    it.each([
      ["bare LF", `3\nabc\r\n0\r\n\r\n`],
      ["broken data CRLF", `3\r\nabcXX\r\n0\r\n\r\n`],
      ["truncated data", `3\r\nab`],
      ["missing final empty line", `3\r\nabc\r\n0\r\n`],
      ["truncated trailer", `0\r\na:1\r\n`],
      ["multiple terminal chunks", `0\r\n0\r\n\r\n`],
      ["same-chunk trailing bytes", `0\r\n\r\nextra`],
      ["concatenated messages", `0\r\n\r\n0\r\n\r\n`],
    ])("should reject %s", (_name, encoded) => {
      expect(() => decode(encoded, Infinity, new AwsChunkedParser({ declaredTrailers: ["a"] }))).toThrow(
        AwsChunkedDecodeError
      );
    });

    it("should reject trailing bytes delivered in a later write", () => {
      const parser = new AwsChunkedParser();
      parser.write(fromUtf8(`0\r\n\r\n`));
      expect(() => parser.write(fromUtf8("extra"))).toThrow(/data after the terminal trailer section/);
    });

    it("should report the same malformed error for arbitrary fragmentation", () => {
      const malformed = `3\r\nabc\r\nZZ\r\n0\r\n\r\n`;
      for (const splitSize of [1, 2, 5, Infinity]) {
        expect(() => decode(malformed, splitSize)).toThrow(AwsChunkedDecodeError);
      }
    });
  });

  describe("decoded content length", () => {
    it("should count decoded bytes and accept a matching declaration", () => {
      const parser = new AwsChunkedParser({ decodedContentLength: alphabet.length });
      expect(decode(frame(alphabet), 3, parser)).toEqual(alphabet);
      expect(parser.decodedBytes).toEqual(alphabet.length);
    });

    it("should reject a declared length that is too small", () => {
      const parser = new AwsChunkedParser({ decodedContentLength: 10 });
      expect(() => decode(frame(alphabet), Infinity, parser)).toThrow(/exceeds the declared decoded content length/);
    });

    it("should reject a declared length that is too large", () => {
      const parser = new AwsChunkedParser({ decodedContentLength: 100 });
      expect(() => decode(frame(alphabet), Infinity, parser)).toThrow(/does not match the declared/);
    });

    it("should accept zero for an empty payload", () => {
      expect(decode(`0\r\n\r\n`, Infinity, new AwsChunkedParser({ decodedContentLength: 0 }))).toEqual("");
    });

    it("should reject invalid declared lengths", () => {
      expect(() => new AwsChunkedParser({ decodedContentLength: -1 })).toThrow(/is negative/);
      expect(() => new AwsChunkedParser({ decodedContentLength: 1.5 })).toThrow(/not a safe non-negative integer/);
      expect(() => new AwsChunkedParser({ decodedContentLength: Number.MAX_SAFE_INTEGER + 2 })).toThrow(
        /not a safe non-negative integer/
      );
    });

    it("should reject cumulative decoded-byte overflow before addition", () => {
      const parser = new AwsChunkedParser();
      const state = parser as unknown as {
        state: string;
        chunkRemaining: number;
        decodedByteCount: number;
      };
      state.state = "CHUNK_DATA";
      state.chunkRemaining = 1;
      state.decodedByteCount = Number.MAX_SAFE_INTEGER;
      expect(() => parser.write(Uint8Array.of(0))).toThrow(/cumulative decoded byte count/);
      expect(parser.decodedBytes).toEqual(Number.MAX_SAFE_INTEGER);
    });
  });

  describe("resource limits", () => {
    it("should accept a valid control line exactly at the limit", () => {
      const extensionName = "x".repeat(MAX_CHUNK_CONTROL_LINE_LENGTH - "3;".length - "\r\n".length);
      expect(decode(`3;${extensionName}\r\nabc\r\n0\r\n\r\n`, Infinity)).toEqual("abc");
    });

    it("should reject a control line one byte over the limit", () => {
      const extensionName = "x".repeat(MAX_CHUNK_CONTROL_LINE_LENGTH - "3;".length - "\r\n".length + 1);
      expect(() => decode(`3;${extensionName}\r\nabc\r\n0\r\n\r\n`, Infinity)).toThrow(
        new RegExp(`control line exceeds the ${MAX_CHUNK_CONTROL_LINE_LENGTH} byte limit`)
      );
    });

    it("should accept a trailer line exactly at the limit", () => {
      const value = "v".repeat(MAX_TRAILER_LINE_LENGTH - "a:".length - "\r\n".length);
      const parser = new AwsChunkedParser({ declaredTrailers: ["a"] });
      decode(`0\r\na:${value}\r\n\r\n`, Infinity, parser);
      expect(parser.trailers[0].value).toHaveLength(value.length);
    });

    it("should reject a trailer line one byte over the limit", () => {
      const value = "v".repeat(MAX_TRAILER_LINE_LENGTH - "a:".length - "\r\n".length + 1);
      expect(() =>
        decode(`0\r\na:${value}\r\n\r\n`, Infinity, new AwsChunkedParser({ declaredTrailers: ["a"] }))
      ).toThrow(new RegExp(`trailer line exceeds the ${MAX_TRAILER_LINE_LENGTH} byte limit`));
    });

    const aggregateTrailerSection = (lastLineLength: number): { declarations: string[]; section: string } => {
      const declarations: string[] = [];
      let section = "";
      for (let i = 0; i < 8; ++i) {
        const name = `f${i}`;
        declarations.push(name);
        const lineLength = i === 7 ? lastLineLength : MAX_TRAILER_LINE_LENGTH;
        const value = "v".repeat(lineLength - `${name}:`.length - "\r\n".length);
        section += `${name}:${value}\r\n`;
      }
      return { declarations, section };
    };

    it("should accept a trailer section exactly at the aggregate limit", () => {
      const { declarations, section } = aggregateTrailerSection(MAX_TRAILER_LINE_LENGTH - 2);
      const parser = new AwsChunkedParser({ declaredTrailers: declarations });
      expect(decode(`0\r\n${section}\r\n`, Infinity, parser)).toEqual("");
      expect(parser.trailers).toHaveLength(8);
    });

    it("should reject a trailer section one byte over the aggregate limit", () => {
      const { declarations, section } = aggregateTrailerSection(MAX_TRAILER_LINE_LENGTH - 1);
      expect(() =>
        decode(`0\r\n${section}\r\n`, Infinity, new AwsChunkedParser({ declaredTrailers: declarations }))
      ).toThrow(new RegExp(`trailer section exceeds the ${MAX_TRAILER_SECTION_LENGTH} byte limit`));
    });

    it("should accept exactly the maximum number of physical trailer fields", () => {
      const lines = `a:v\r\n`.repeat(MAX_TRAILER_FIELD_COUNT);
      const parser = new AwsChunkedParser({ declaredTrailers: ["a"] });
      decode(`0\r\n${lines}\r\n`, Infinity, parser);
      expect(parser.trailers).toHaveLength(MAX_TRAILER_FIELD_COUNT);
    });

    it("should reject one physical trailer field over the limit", () => {
      const lines = `a:v\r\n`.repeat(MAX_TRAILER_FIELD_COUNT + 1);
      expect(() => decode(`0\r\n${lines}\r\n`, Infinity, new AwsChunkedParser({ declaredTrailers: ["a"] }))).toThrow(
        new RegExp(`trailer section exceeds the ${MAX_TRAILER_FIELD_COUNT} field limit`)
      );
    });

    it("should enforce line limits before growing a split buffer", () => {
      const parser = new AwsChunkedParser();
      const filler = fromUtf8("x".repeat(1024));
      expect(() => {
        for (let i = 0; i < 16; ++i) {
          parser.write(filler);
        }
      }).toThrow(/control line exceeds/);
    });
  });

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
