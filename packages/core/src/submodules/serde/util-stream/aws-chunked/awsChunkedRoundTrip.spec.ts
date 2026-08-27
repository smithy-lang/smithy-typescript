import { Readable } from "node:stream";
import { describe, expect, test as it } from "vitest";

import { toBase64 } from "../../util-base64/toBase64";
import { calculateBodyLength } from "../../util-body-length/calculateBodyLength";
import { fromUtf8 } from "../../util-utf8/fromUtf8";
import { toUtf8 } from "../../util-utf8/toUtf8";
import { getAwsChunkedEncodingStream } from "../getAwsChunkedEncodingStream";
import { getAwsChunkedEncodingStream as getAwsChunkedEncodingStreamWeb } from "../getAwsChunkedEncodingStream.browser";
import { createAwsChunkedResponseDecoder } from "./createAwsChunkedResponseDecoder";
import { createAwsChunkedResponseDecoder as createAwsChunkedResponseDecoderWeb } from "./createAwsChunkedResponseDecoder.browser";

/**
 * The encoder and the decoder are two halves of one framing contract, so
 * anything the encoder produces must be decodable, byte for byte, by the
 * decoder. These tests pin that contract from both directions.
 */
describe("aws-chunked round trip (Node.js)", () => {
  const CHECKSUM_LOCATION = "x-amz-checksum-crc32";
  const rawChecksum = new Uint8Array([1, 2, 3, 4]);

  const checksumOptions = {
    base64Encoder: toBase64,
    bodyLengthChecker: calculateBodyLength,
    checksumAlgorithmFn: (() => {}) as any,
    checksumLocationName: CHECKSUM_LOCATION,
    streamHasher: (() => Promise.resolve(rawChecksum)) as any,
  };

  const collect = async (stream: Readable): Promise<Uint8Array> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return new Uint8Array(Buffer.concat(chunks));
  };

  /**
   * Encode the given source chunks, then decode the result.
   */
  const roundTrip = async (
    chunks: Array<Uint8Array | string>,
    { withChecksum }: { withChecksum: boolean }
  ): Promise<{ payload: Uint8Array; trailers: Record<string, string> }> => {
    const source = Readable.from(chunks.map((chunk) => (typeof chunk === "string" ? Buffer.from(chunk) : chunk)));

    const encoded = getAwsChunkedEncodingStream(
      source,
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

    const payload = await collect(body);
    return { payload, trailers: await trailers };
  };

  describe("with a checksum trailer", () => {
    it("should round-trip a single chunk", async () => {
      const { payload, trailers } = await roundTrip(["Hello"], { withChecksum: true });
      expect(toUtf8(payload)).toEqual("Hello");
      expect(trailers).toEqual({ [CHECKSUM_LOCATION]: toBase64(rawChecksum) });
    });

    it("should round-trip multiple chunks", async () => {
      const { payload } = await roundTrip(["Hello", "World", "!"], { withChecksum: true });
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

    it("should round-trip a payload larger than one chunk boundary", async () => {
      const chunks = Array.from({ length: 40 }, (_, i) => fromUtf8(`chunk-${i};`));
      const expected = chunks.map(toUtf8).join("");

      const { payload } = await roundTrip(chunks, { withChecksum: true });
      expect(toUtf8(payload)).toEqual(expected);
    });

    it("should skip zero-length source chunks without ending the framing early", async () => {
      const { payload } = await roundTrip([fromUtf8("a"), new Uint8Array(), fromUtf8("b")], { withChecksum: true });
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
  });

  describe("without a checksum trailer", () => {
    it("should round-trip a single chunk", async () => {
      const { payload, trailers } = await roundTrip(["Hello"], { withChecksum: false });
      expect(toUtf8(payload)).toEqual("Hello");
      expect(trailers).toEqual({});
    });

    it("should round-trip an empty payload", async () => {
      const { payload } = await roundTrip([], { withChecksum: false });
      expect(payload).toEqual(new Uint8Array());
    });
  });

  /**
   * The two runtime pairs must implement one framing contract, so bytes
   * produced on either side have to decode on the other.
   */
  describe("cross-runtime", () => {
    const binary = new Uint8Array(256);
    for (let i = 0; i < 256; ++i) {
      binary[i] = i;
    }

    const collectWeb = async (stream: ReadableStream): Promise<Uint8Array> => {
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

    const webSourceOf = (bytes: Uint8Array): ReadableStream =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });

    const encodeWithNode = (payload: Uint8Array): Promise<Uint8Array> =>
      collect(getAwsChunkedEncodingStream(Readable.from([Buffer.from(payload)]), checksumOptions));

    const encodeWithWeb = (payload: Uint8Array): Promise<Uint8Array> =>
      collectWeb(getAwsChunkedEncodingStreamWeb(webSourceOf(payload), checksumOptions));

    it("should produce byte-identical framing from both encoders", async () => {
      expect(await encodeWithWeb(binary)).toEqual(await encodeWithNode(binary));
    });

    it("should decode Node-encoded framing with the web decoder", async () => {
      const { body, trailers } = createAwsChunkedResponseDecoderWeb({
        source: webSourceOf(await encodeWithNode(binary)),
        declaredTrailers: [CHECKSUM_LOCATION],
        decodedContentLength: binary.byteLength,
      });

      expect(await collectWeb(body)).toEqual(binary);
      expect(await trailers).toEqual({ [CHECKSUM_LOCATION]: toBase64(rawChecksum) });
    });

    it("should decode web-encoded framing with the Node decoder", async () => {
      const { body, trailers } = createAwsChunkedResponseDecoder({
        source: Readable.from([Buffer.from(await encodeWithWeb(binary))]),
        declaredTrailers: [CHECKSUM_LOCATION],
        decodedContentLength: binary.byteLength,
      });

      expect(await collect(body)).toEqual(binary);
      expect(await trailers).toEqual({ [CHECKSUM_LOCATION]: toBase64(rawChecksum) });
    });
  });

  it("should emit a terminating blank line so the framing is complete", async () => {
    const encoded = await collect(
      getAwsChunkedEncodingStream(Readable.from([Buffer.from("Hello")]), {
        bodyLengthChecker: calculateBodyLength,
      })
    );

    expect(toUtf8(encoded)).toEqual("5\r\nHello\r\n0\r\n\r\n");
  });
});
