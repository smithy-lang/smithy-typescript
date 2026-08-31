import { describe, expect, test as it } from "vitest";

import { fromUtf8 } from "../../util-utf8/fromUtf8";
import { toUtf8 } from "../../util-utf8/toUtf8";
import { AwsChunkedDecodeError } from "./AwsChunkedDecodeError";
import { createAwsChunkedResponseDecoder } from "./createAwsChunkedResponseDecoder.browser";

(typeof ReadableStream === "function" && process.version >= "v18" ? describe : describe.skip)(
  "createAwsChunkedResponseDecoder webstreams API",
  () => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";

    const frame = (payload: string, trailers: Record<string, string> = {}): string => {
      const chunk = payload.length > 0 ? `${payload.length.toString(16)}\r\n${payload}\r\n` : "";
      const trailerLines = Object.entries(trailers)
        .map(([name, value]) => `${name}:${value}\r\n`)
        .join("");
      return `${chunk}0\r\n${trailerLines}\r\n`;
    };

    const makeSource = (encoded: string, splitSize = Infinity): ReadableStream => {
      const bytes = fromUtf8(encoded);
      return new ReadableStream({
        start(controller) {
          for (let i = 0; i < bytes.byteLength; i += splitSize) {
            controller.enqueue(bytes.subarray(i, Math.min(i + splitSize, bytes.byteLength)));
          }
          controller.close();
        },
      });
    };

    const collect = async (stream: ReadableStream): Promise<string> => {
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
      return toUtf8(new Uint8Array(out));
    };

    it("should return a ReadableStream", () => {
      const { body } = createAwsChunkedResponseDecoder({ source: makeSource(frame(alphabet)) });
      expect(body).toBeInstanceOf(ReadableStream);
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

    it("should produce the same malformed-response error as the Node adapter", async () => {
      const { body } = createAwsChunkedResponseDecoder({ source: makeSource(`zz\r\nabc\r\n0\r\n\r\n`) });
      await expect(collect(body)).rejects.toThrow(AwsChunkedDecodeError);
    });

    it("should reject the trailers with the same error the body surfaces", async () => {
      const { body, trailers } = createAwsChunkedResponseDecoder({ source: makeSource(`zz\r\n`) });

      const bodyError = await collect(body).catch((e) => e);
      const trailerError = await trailers.catch((e) => e);
      expect(trailerError).toBe(bodyError);
    });

    it("should reject a truncated body", async () => {
      const { body } = createAwsChunkedResponseDecoder({ source: makeSource(`3\r\nab`) });
      await expect(collect(body)).rejects.toThrow(/framing is truncated/);
    });

    it("should not raise an unhandled rejection when the trailers are ignored", async () => {
      const { body } = createAwsChunkedResponseDecoder({ source: makeSource(`zz\r\n`) });
      await expect(collect(body)).rejects.toThrow(AwsChunkedDecodeError);
      await new Promise((r) => setTimeout(r, 50));
    });

    it("should surface a source error", async () => {
      const source = new ReadableStream({
        start(controller) {
          controller.error(new Error("source failure"));
        },
      });
      const { body } = createAwsChunkedResponseDecoder({ source });
      await expect(collect(body)).rejects.toThrow("source failure");
    });

    describe("cancellation", () => {
      it("should cancel the source and reject the trailers when cancelled through a reader", async () => {
        const source = makeSource(frame(alphabet), 4);
        const { body, trailers } = createAwsChunkedResponseDecoder({ source });

        const reader = body.getReader();
        await reader.read();
        await reader.cancel("consumer stopped");

        await expect(trailers).rejects.toThrow(/cancelled before the framing was complete/);
      });

      it("should reject the trailers when the body itself is cancelled", async () => {
        const { body, trailers } = createAwsChunkedResponseDecoder({ source: makeSource(frame(alphabet), 4) });

        await body.cancel("consumer stopped");

        await expect(trailers).rejects.toThrow(/cancelled before the framing was complete/);
      });

      it("should validate completed framing before it can be cancelled", async () => {
        const source = new ReadableStream({
          start(controller) {
            controller.enqueue(fromUtf8(frame("abc")));
          },
        });
        const { body, trailers } = createAwsChunkedResponseDecoder({ source, decodedContentLength: 4 });

        const reader = body.getReader();
        await expect(reader.read()).rejects.toThrow(/does not match the declared/);
        await expect(trailers).rejects.toThrow(/does not match the declared/);
      });

      it("should not reject the trailers when cancelled after the framing completed", async () => {
        const { body, trailers } = createAwsChunkedResponseDecoder({
          source: makeSource(frame(alphabet)),
        });

        expect(await collect(body)).toEqual(alphabet);
        await body.cancel("done");

        expect(await trailers).toEqual({});
      });
    });

    it("should read again rather than stall when a source chunk holds only framing", async () => {
      // The first source chunk is the size line alone, which yields no payload.
      const source = new ReadableStream({
        start(controller) {
          controller.enqueue(fromUtf8("3\r\n"));
          controller.enqueue(fromUtf8("abc\r\n"));
          controller.enqueue(fromUtf8("0\r\n\r\n"));
          controller.close();
        },
      });
      const { body } = createAwsChunkedResponseDecoder({ source });

      const reader = body.getReader();
      const first = await reader.read();
      expect(toUtf8(first.value!)).toEqual("abc");
    });
  }
);
