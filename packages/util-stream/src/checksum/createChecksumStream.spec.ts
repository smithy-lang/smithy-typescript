import type { Checksum } from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";
import { toUtf8 } from "@smithy/util-utf8";
import { Readable } from "stream";
import { describe, expect, test as it } from "vitest";

import { headStream } from "../headStream";
import { ChecksumStream } from "./ChecksumStream";
import { ChecksumStream as ChecksumStreamWeb } from "./ChecksumStream.browser";
import { createChecksumStream } from "./createChecksumStream";

describe("Checksum streams", () => {
  /**
   * Hash "algorithm" that appends all data together.
   */
  class Appender implements Checksum {
    public hash = "";
    async digest(): Promise<Uint8Array> {
      return Buffer.from(this.hash);
    }
    reset(): void {
      throw new Error("Function not implemented.");
    }
    update(chunk: Uint8Array): void {
      this.hash += toUtf8(chunk);
    }
  }

  const canonicalData = new Uint8Array("abcdefghijklmnopqrstuvwxyz".split("").map((_) => _.charCodeAt(0)));

  const canonicalUtf8 = toUtf8(canonicalData);
  const canonicalBase64 = toBase64(canonicalUtf8);

  describe(createChecksumStream.name, () => {
    const makeStream = () => {
      return Readable.from(Buffer.from(canonicalData.buffer, 0, 26));
    };

    it("should extend a Readable stream", async () => {
      const stream = makeStream();
      const checksumStream = createChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: stream,
      });

      expect(checksumStream).toBeInstanceOf(Readable);
      expect(checksumStream).toBeInstanceOf(ChecksumStream);

      const collected = toUtf8(await headStream(checksumStream, Infinity));
      expect(collected).toEqual(canonicalUtf8);
      expect(stream.readableEnded).toEqual(true);
      expect(checksumStream.readableEnded).toEqual(true);
    });

    it("should throw during stream read if the checksum does not match", async () => {
      const stream = makeStream();
      const checksumStream = createChecksumStream({
        expectedChecksum: "different-expected-checksum",
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: stream,
      });

      try {
        toUtf8(await headStream(checksumStream, Infinity));
        throw new Error("stream was read successfully");
      } catch (e: unknown) {
        expect(String(e)).toEqual(
          `Error: Checksum mismatch: expected "different-expected-checksum" but` +
            ` received "${canonicalBase64}"` +
            ` in response header "my-header".`
        );
      }
    });

    it("should handle backpressure", async () => {
      // for Node.js 22+ increased default highwater mark.
      Readable.setDefaultHighWaterMark(false, 16_384);
      let originalStreamBuffered = 0;
      const stream = Readable.from(
        {
          async *[Symbol.asyncIterator]() {
            for (let i = 0; i < 100; ++i) {
              const chunk = new Uint8Array(16_384);
              originalStreamBuffered += chunk.byteLength;
              yield chunk;
            }
          },
        },
        {
          highWaterMark: 1,
        }
      );
      const checksumStream = createChecksumStream({
        expectedChecksum: toBase64(new Uint8Array()),
        checksum: {
          async digest() {
            return new Uint8Array();
          },
          update: () => {},
          reset: () => {},
        },
        checksumSourceLocation: "my-header",
        source: stream,
      });

      const ait = checksumStream[Symbol.asyncIterator]();

      const c1 = await ait.next();
      expect(c1.done).toBe(false);
      expect(c1.value.byteLength).toEqual(16_384);
      expect(originalStreamBuffered).toBeLessThanOrEqual(16_384 * 2);

      await new Promise((r) => setTimeout(r, 200));
      expect(originalStreamBuffered).toBeLessThanOrEqual(16_384 * 3);

      const c2 = await ait.next();
      expect(c2.done).toBe(false);
      expect(c2.value.byteLength).toEqual(16_384);
      expect(originalStreamBuffered).toBeLessThanOrEqual(16_384 * 4);

      await new Promise((r) => setTimeout(r, 200));
      expect(originalStreamBuffered).toBeLessThanOrEqual(16_384 * 4);

      await new Promise((r) => setTimeout(r, 200));
      expect(originalStreamBuffered).toBeLessThanOrEqual(16_384 * 4);

      // the stream yields at the rate at which we read it.
      let i = 5;
      while (true) {
        const { done } = await ait.next();
        await new Promise((r) => setTimeout(r, 5));
        expect(originalStreamBuffered).toBeLessThanOrEqual(16_384 * i++);
        if (done) {
          break;
        }
      }

      expect(originalStreamBuffered).toEqual(16_384 * 100);
    });
  });

  describe(createChecksumStream.name + " webstreams API", () => {
    if (typeof ReadableStream !== "function") {
      it.skip("Skipped when ReadableStream is not globally available.", () => {});
      // test not applicable to Node.js 16.
      return;
    }

    const makeStream = () => {
      return new ReadableStream({
        start(controller) {
          canonicalData.forEach((byte) => {
            controller.enqueue(new Uint8Array([byte]));
          });
          controller.close();
        },
      });
    };

    it("should extend a ReadableStream", async () => {
      const stream = makeStream();
      const checksumStream = createChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: stream,
      });

      expect(checksumStream).toBeInstanceOf(ReadableStream);
      expect(checksumStream).toBeInstanceOf(ChecksumStreamWeb);

      const collected = toUtf8(await headStream(checksumStream, Infinity));
      expect(collected).toEqual(canonicalUtf8);
      expect(stream.locked).toEqual(true);

      // expectation is that it is resolved.
      expect(await checksumStream.getReader().closed);
    });

    it("should throw during stream read if the checksum does not match", async () => {
      const stream = makeStream();
      const checksumStream = createChecksumStream({
        expectedChecksum: "different-expected-checksum",
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: stream,
      });

      try {
        toUtf8(await headStream(checksumStream, Infinity));
        throw new Error("stream was read successfully");
      } catch (e: unknown) {
        expect(String(e)).toEqual(
          `Error: Checksum mismatch: expected "different-expected-checksum" but` +
            ` received "${canonicalBase64}"` +
            ` in response header "my-header".`
        );
      }
    });
  });
});
