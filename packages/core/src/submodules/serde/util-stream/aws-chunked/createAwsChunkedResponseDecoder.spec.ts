import { Readable } from "node:stream";
import { describe, expect, test as it } from "vitest";

import { fromUtf8 } from "../../util-utf8/fromUtf8";
import { toUtf8 } from "../../util-utf8/toUtf8";
import { AwsChunkedDecodeError } from "./AwsChunkedDecodeError";
import { createAwsChunkedResponseDecoder } from "./createAwsChunkedResponseDecoder";

describe(createAwsChunkedResponseDecoder.name, () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";

  const frame = (payload: string, trailers: Record<string, string> = {}): string => {
    const chunk = payload.length > 0 ? `${payload.length.toString(16)}\r\n${payload}\r\n` : "";
    const trailerLines = Object.entries(trailers)
      .map(([name, value]) => `${name}:${value}\r\n`)
      .join("");
    return `${chunk}0\r\n${trailerLines}\r\n`;
  };

  /**
   * A source that emits the encoded body in fragments of the given size.
   */
  const makeSource = (encoded: string, splitSize = Infinity): Readable => {
    const bytes = fromUtf8(encoded);
    const parts: Buffer[] = [];
    for (let i = 0; i < bytes.byteLength; i += splitSize) {
      parts.push(Buffer.from(bytes.subarray(i, Math.min(i + splitSize, bytes.byteLength))));
    }
    return Readable.from(parts);
  };

  const collect = async (stream: Readable): Promise<string> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return toUtf8(new Uint8Array(Buffer.concat(chunks)));
  };

  it("should return a Readable for a Readable source", () => {
    const { body } = createAwsChunkedResponseDecoder({ source: makeSource(frame(alphabet)) });
    expect(body).toBeInstanceOf(Readable);
  });

  it("should decode the payload and remove all framing", async () => {
    const { body } = createAwsChunkedResponseDecoder({ source: makeSource(frame(alphabet)) });
    expect(await collect(body)).toEqual(alphabet);
  });

  it("should resolve the trailers once the body is consumed", async () => {
    const { body, trailers } = createAwsChunkedResponseDecoder({
      source: makeSource(frame(alphabet, { "x-amz-stream-checksum-crc32": "AAAAAA==" })),
      declaredTrailers: ["x-amz-stream-checksum-crc32"],
    });

    expect(await collect(body)).toEqual(alphabet);
    expect(await trailers).toEqual({ "x-amz-stream-checksum-crc32": "AAAAAA==" });
  });

  it("should decode an empty payload", async () => {
    const { body, trailers } = createAwsChunkedResponseDecoder({ source: makeSource(frame("")) });
    expect(await collect(body)).toEqual("");
    expect(await trailers).toEqual({});
  });

  for (const splitSize of [1, 2, 3, 8, Infinity]) {
    it(`should decode identically with ${splitSize} bytes per source chunk`, async () => {
      const { body, trailers } = createAwsChunkedResponseDecoder({
        source: makeSource(frame(alphabet, { "x-amz-checksum-crc32": "AAAAAA==" }), splitSize),
        decodedContentLength: 26,
      });
      expect(await collect(body)).toEqual(alphabet);
      expect(await trailers).toEqual({ "x-amz-checksum-crc32": "AAAAAA==" });
    });
  }

  describe("errors", () => {
    it("should surface malformed framing on the body", async () => {
      const { body } = createAwsChunkedResponseDecoder({ source: makeSource(`zz\r\nabc\r\n0\r\n\r\n`) });
      await expect(collect(body)).rejects.toThrow(AwsChunkedDecodeError);
    });

    it("should reject the trailers with the same error the body surfaces", async () => {
      const { body, trailers } = createAwsChunkedResponseDecoder({ source: makeSource(`zz\r\n`) });

      const bodyError = await collect(body).catch((e) => e);
      const trailerError = await trailers.catch((e) => e);
      expect(trailerError).toBe(bodyError);
    });

    it("should reject the trailers when a declared trailer never arrives", async () => {
      const { body, trailers } = createAwsChunkedResponseDecoder({
        source: makeSource(frame(alphabet)),
        declaredTrailers: ["x-amz-stream-checksum-crc32"],
      });

      await expect(collect(body)).rejects.toThrow(/declared trailer/);
      await expect(trailers).rejects.toThrow(/declared trailer/);
    });

    it("should not raise an unhandled rejection when the trailers are ignored", async () => {
      const { body } = createAwsChunkedResponseDecoder({ source: makeSource(`zz\r\n`) });
      // The trailers promise is deliberately never read.
      await expect(collect(body)).rejects.toThrow(AwsChunkedDecodeError);
      await new Promise((r) => setTimeout(r, 50));
    });

    it("should surface an error emitted by the source", async () => {
      const source = makeSource(frame(alphabet));
      const { body } = createAwsChunkedResponseDecoder({ source });

      const sourceError = new Error("source failure");
      const streamError = new Promise<Error>((resolve) => body.once("error", resolve));
      source.emit("error", sourceError);

      expect(await streamError).toBe(sourceError);
      expect(source.destroyed).toBe(true);
    });

    it("should error when the source closes before the framing is complete", async () => {
      const source = new Readable({
        read() {
          this.push(Buffer.from("3\r\nab"));
          this.destroy();
        },
      });
      const { body } = createAwsChunkedResponseDecoder({ source });

      await expect(collect(body)).rejects.toThrow(/connection lost or stream closed/);
    });

    it("should throw an invalid declared length to the caller", () => {
      expect(() =>
        createAwsChunkedResponseDecoder({ source: makeSource(frame(alphabet)), decodedContentLength: -1 })
      ).toThrow(/is negative/);
    });

    it("should reject the trailers when the decoded stream is destroyed early", async () => {
      const source = new Readable({ read() {} });
      const { body, trailers } = createAwsChunkedResponseDecoder({ source });

      source.push(Buffer.from(`3\r\nabc\r\n`));
      body.destroy();

      await expect(trailers).rejects.toThrow(/destroyed before the framing was complete/);
    });
  });

  describe("lifecycle", () => {
    it("should not read from the source until the body is consumed", async () => {
      const source = makeSource(frame(alphabet));
      createAwsChunkedResponseDecoder({ source });

      expect(source.isPaused()).toBe(true);
      await new Promise((r) => setTimeout(r, 50));
      expect(source.readableEnded).toBe(false);
    });

    it("should destroy the source when the body is destroyed", () => {
      const source = makeSource(frame(alphabet));
      const { body } = createAwsChunkedResponseDecoder({ source });

      body.destroy();

      expect(body.destroyed).toBe(true);
      expect(source.destroyed).toBe(true);
    });

    it("should throw for an unsupported source type", () => {
      expect(() => createAwsChunkedResponseDecoder({ source: "not-a-stream" as any })).toThrow(
        /unsupported source type/
      );
    });

    it("should preserve backpressure over a large body", async () => {
      Readable.setDefaultHighWaterMark(false, 16_384);
      let sourceBuffered = 0;
      const payload = "x".repeat(16_384);
      const encoded = `${(16_384).toString(16)}\r\n${payload}\r\n`.repeat(50) + `0\r\n\r\n`;
      const bytes = fromUtf8(encoded);

      const source = Readable.from(
        {
          async *[Symbol.asyncIterator]() {
            for (let i = 0; i < bytes.byteLength; i += 16_384) {
              const part = bytes.subarray(i, Math.min(i + 16_384, bytes.byteLength));
              sourceBuffered += part.byteLength;
              yield Buffer.from(part);
            }
          },
        },
        { highWaterMark: 1 }
      );

      const { body } = createAwsChunkedResponseDecoder({ source });
      const ait = body[Symbol.asyncIterator]();

      await ait.next();
      // Only a bounded amount of encoded data has been pulled from the source.
      expect(sourceBuffered).toBeLessThanOrEqual(16_384 * 4);

      await new Promise((r) => setTimeout(r, 100));
      expect(sourceBuffered).toBeLessThanOrEqual(16_384 * 5);

      body.destroy();
    });
  });
});
