import { describe, expect, test as it } from "vitest";

import { toBase64 } from "../../util-base64/toBase64.browser";
import { calculateBodyLength } from "../../util-body-length/calculateBodyLength.browser";
import { fromUtf8 } from "../../util-utf8/fromUtf8.browser";
import { toUtf8 } from "../../util-utf8/toUtf8.browser";
import { getAwsChunkedEncodingStream } from "../getAwsChunkedEncodingStream.browser";
import { createAwsChunkedResponseDecoder } from "./createAwsChunkedResponseDecoder.browser";

/**
 * The web encoder and decoder must agree on the same framing contract as the
 * Node.js pair, and must move bytes rather than stringified byte arrays.
 */
(typeof ReadableStream === "function" && process.version >= "v18" ? describe : describe.skip)(
  "aws-chunked round trip (web)",
  () => {
    const CHECKSUM_LOCATION = "x-amz-checksum-crc32";
    const rawChecksum = new Uint8Array([1, 2, 3, 4]);

    const checksumOptions = {
      base64Encoder: toBase64,
      bodyLengthChecker: calculateBodyLength,
      checksumAlgorithmFn: (() => {}) as any,
      checksumLocationName: CHECKSUM_LOCATION,
      streamHasher: (() => Promise.resolve(rawChecksum)) as any,
    };

    const makeSource = (chunks: Array<Uint8Array | string>): ReadableStream =>
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

    const collect = async (stream: ReadableStream): Promise<Uint8Array> => {
      const reader = stream.getReader();
      const out: number[] = [];
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          out.push(...value);
        }
      } finally {
        reader.releaseLock();
      }
      return new Uint8Array(out);
    };

    const roundTrip = async (
      chunks: Array<Uint8Array | string>,
      { withChecksum }: { withChecksum: boolean }
    ): Promise<{ payload: Uint8Array; trailers: Record<string, string> }> => {
      const encoded = getAwsChunkedEncodingStream(
        makeSource(chunks),
        withChecksum ? checksumOptions : { bodyLengthChecker: calculateBodyLength }
      );

      const { body, trailers } = createAwsChunkedResponseDecoder({
        source: encoded,
        declaredTrailers: withChecksum ? [CHECKSUM_LOCATION] : [],
        // Declaring the true payload length asserts that the encoder's chunk
        // sizes and the decoder's byte accounting agree, which is what the
        // x-amz-decoded-content-length response header does in practice.
        decodedContentLength: chunks.reduce((total, chunk) => total + (calculateBodyLength(chunk) ?? 0), 0),
      });

      return { payload: await collect(body), trailers: await trailers };
    };

    it("should enqueue byte arrays rather than stringified chunks", async () => {
      const encoded = getAwsChunkedEncodingStream(makeSource([fromUtf8("Hello")]), {
        bodyLengthChecker: calculateBodyLength,
      });

      const reader = encoded.getReader();
      const { value } = await reader.read();
      // A request body stream must yield BufferSource chunks; a string chunk is
      // rejected by fetch and would also stringify byte arrays.
      expect(value).toBeInstanceOf(Uint8Array);
    });

    it("should round-trip a single chunk", async () => {
      const { payload, trailers } = await roundTrip([fromUtf8("Hello")], { withChecksum: true });
      expect(toUtf8(payload)).toEqual("Hello");
      expect(trailers).toEqual({ [CHECKSUM_LOCATION]: toBase64(rawChecksum) });
    });

    it("should round-trip multiple chunks", async () => {
      const { payload } = await roundTrip([fromUtf8("Hello"), fromUtf8("World"), fromUtf8("!")], {
        withChecksum: true,
      });
      expect(toUtf8(payload)).toEqual("HelloWorld!");
    });

    it("should round-trip an empty payload", async () => {
      const { payload, trailers } = await roundTrip([], { withChecksum: true });
      expect(payload).toEqual(new Uint8Array());
      expect(trailers).toEqual({ [CHECKSUM_LOCATION]: toBase64(rawChecksum) });
    });

    it("should round-trip every byte value without corruption", async () => {
      const binary = new Uint8Array(256);
      for (let i = 0; i < 256; ++i) {
        binary[i] = i;
      }

      const { payload } = await roundTrip([binary], { withChecksum: true });
      expect(payload).toEqual(binary);
    });

    it("should round-trip multibyte utf8 without corruption", async () => {
      const text = "ol\u00e1 \u4e16\u754c \u{1f600}";
      const { payload } = await roundTrip([fromUtf8(text)], { withChecksum: true });
      expect(toUtf8(payload)).toEqual(text);
    });

    it("should skip zero-length source chunks without ending the framing early", async () => {
      const { payload } = await roundTrip([fromUtf8("a"), new Uint8Array(), fromUtf8("b")], {
        withChecksum: true,
      });
      expect(toUtf8(payload)).toEqual("ab");
    });

    it("should round-trip a source of only zero-length chunks as an empty payload", async () => {
      // The encoder emits nothing but the terminal chunk and its trailer.
      const { payload, trailers } = await roundTrip([new Uint8Array(), new Uint8Array(), new Uint8Array()], {
        withChecksum: true,
      });
      expect(payload).toEqual(new Uint8Array());
      expect(trailers).toEqual({ [CHECKSUM_LOCATION]: toBase64(rawChecksum) });
    });

    it("should round-trip without a checksum trailer", async () => {
      const { payload, trailers } = await roundTrip([fromUtf8("Hello")], { withChecksum: false });
      expect(toUtf8(payload)).toEqual("Hello");
      expect(trailers).toEqual({});
    });

    it("should produce the same encoded bytes as the Node.js encoder", async () => {
      const encoded = await collect(
        getAwsChunkedEncodingStream(makeSource([fromUtf8("Hello")]), {
          bodyLengthChecker: calculateBodyLength,
        })
      );

      expect(toUtf8(encoded)).toEqual("5\r\nHello\r\n0\r\n\r\n");
    });
  }
);
