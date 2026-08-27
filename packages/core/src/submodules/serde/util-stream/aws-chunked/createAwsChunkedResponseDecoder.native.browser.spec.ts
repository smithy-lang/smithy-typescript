import { describe, expect, test as it } from "vitest";

import { fromUtf8 } from "../../util-utf8/fromUtf8";
import { toUtf8 } from "../../util-utf8/toUtf8";
import { AwsChunkedDecodeError } from "./AwsChunkedDecodeError";
import { createAwsChunkedResponseDecoder } from "./createAwsChunkedResponseDecoder.native";

(typeof ReadableStream === "function" && typeof Blob === "function" ? describe : describe.skip)(
  "createAwsChunkedResponseDecoder react-native",
  () => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";

    const frame = (payload: string, trailers: Record<string, string> = {}): string => {
      const chunk = payload.length > 0 ? `${payload.length.toString(16)}\r\n${payload}\r\n` : "";
      const trailerLines = Object.entries(trailers)
        .map(([name, value]) => `${name}:${value}\r\n`)
        .join("");
      return `${chunk}0\r\n${trailerLines}\r\n`;
    };

    /**
     * fromUtf8 returns Uint8Array<ArrayBufferLike>, but BlobPart requires the
     * buffer to be a plain ArrayBuffer. Copy into a fresh view to narrow it.
     */
    const toBlobPart = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);

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

    /**
     * A Blob without stream(), which is the case this adapter exists for.
     */
    const makeStreamlessBlob = (encoded: string): Blob => {
      const blob = new Blob([toBlobPart(fromUtf8(encoded))]);
      Object.defineProperty(blob, "stream", { value: undefined });
      return blob;
    };

    it("should decode a Blob that can produce a stream", async () => {
      const blob = new Blob([toBlobPart(fromUtf8(frame(alphabet, { "x-amz-checksum-crc32": "AAAAAA==" })))]);
      if (typeof blob.stream !== "function") {
        return;
      }

      const { body, trailers } = createAwsChunkedResponseDecoder({
        source: blob,
        declaredTrailers: ["x-amz-checksum-crc32"],
      });

      expect(await collect(body)).toEqual(alphabet);
      expect(await trailers).toEqual({ "x-amz-checksum-crc32": "AAAAAA==" });
    });

    it("should decode a Blob without stream() by collecting it", async () => {
      const { body, trailers } = createAwsChunkedResponseDecoder({
        source: makeStreamlessBlob(frame(alphabet, { "x-amz-checksum-crc32": "AAAAAA==" })),
        declaredTrailers: ["x-amz-checksum-crc32"],
        decodedContentLength: 26,
      });

      expect(await collect(body)).toEqual(alphabet);
      expect(await trailers).toEqual({ "x-amz-checksum-crc32": "AAAAAA==" });
    });

    it("should decode an empty payload from a collected Blob", async () => {
      const { body, trailers } = createAwsChunkedResponseDecoder({ source: makeStreamlessBlob(frame("")) });
      expect(await collect(body)).toEqual("");
      expect(await trailers).toEqual({});
    });

    it("should produce the same malformed-response error for a collected Blob", async () => {
      const { body } = createAwsChunkedResponseDecoder({ source: makeStreamlessBlob(`zz\r\nabc\r\n0\r\n\r\n`) });
      await expect(collect(body)).rejects.toThrow(AwsChunkedDecodeError);
    });

    it("should reject a truncated collected Blob", async () => {
      const { body } = createAwsChunkedResponseDecoder({ source: makeStreamlessBlob(`3\r\nab`) });
      await expect(collect(body)).rejects.toThrow(/framing is truncated/);
    });

    it("should reject the trailers when a collected Blob is malformed", async () => {
      const { body, trailers } = createAwsChunkedResponseDecoder({ source: makeStreamlessBlob(`zz\r\n`) });
      await expect(collect(body)).rejects.toThrow(AwsChunkedDecodeError);
      await expect(trailers).rejects.toThrow(AwsChunkedDecodeError);
    });

    it("should delegate a ReadableStream source to the web adapter", async () => {
      const bytes = fromUtf8(frame(alphabet));
      const source = new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });

      const { body } = createAwsChunkedResponseDecoder({ source });
      expect(await collect(body)).toEqual(alphabet);
    });
  }
);
