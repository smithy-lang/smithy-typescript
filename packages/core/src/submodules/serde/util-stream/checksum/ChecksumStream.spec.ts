import { Readable } from "node:stream";
import type { Checksum } from "@smithy/types";
import { describe, expect, test as it, vi } from "vitest";

import { toBase64 } from "../../util-base64/toBase64";
import { toUtf8 } from "../../util-utf8/toUtf8";
import { ChecksumStream } from "./ChecksumStream";

describe(ChecksumStream.name, () => {
  /**
   * Hash "algorithm" that appends all data together so that the
   * digest is the concatenation of every chunk passed to update().
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

  const makeSource = () => Readable.from(Buffer.from(canonicalData.buffer, 0, 26));

  /**
   * Drain a Readable into a single Uint8Array.
   */
  const collect = async (stream: Readable): Promise<Uint8Array> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return new Uint8Array(Buffer.concat(chunks));
  };

  describe("constructor", () => {
    it("should be an instance of Readable", () => {
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
      });
      expect(checksumStream).toBeInstanceOf(Readable);
      expect(checksumStream).toBeInstanceOf(ChecksumStream);
    });

    it("should throw if the source is not a Readable stream", () => {
      expect(
        () =>
          new ChecksumStream({
            expectedChecksum: canonicalBase64,
            checksum: new Appender(),
            checksumSourceLocation: "my-header",
            source: "not-a-stream" as any,
          })
      ).toThrow(/unsupported source type/);
    });
  });

  describe("checksum validation", () => {
    it("should pass the source data through unchanged when the checksum matches", async () => {
      const source = makeSource();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source,
      });

      const collected = toUtf8(await collect(checksumStream));
      expect(collected).toEqual(canonicalUtf8);
      expect(source.readableEnded).toBe(true);
      expect(checksumStream.readableEnded).toBe(true);
    });

    it("should call checksum.update for every chunk read from the source", async () => {
      const checksum = new Appender();
      const updateSpy = vi.spyOn(checksum, "update");
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum,
        checksumSourceLocation: "my-header",
        source: makeSource(),
      });

      await collect(checksumStream);

      expect(updateSpy).toHaveBeenCalled();
      expect(checksum.hash).toEqual(canonicalUtf8);
    });

    it("should throw a descriptive error during read if the checksum does not match", async () => {
      const checksumStream = new ChecksumStream({
        expectedChecksum: "different-expected-checksum",
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
      });

      await expect(collect(checksumStream)).rejects.toThrow(
        `Checksum mismatch: expected "different-expected-checksum" but received "${canonicalBase64}"` +
          ` in response header "my-header".`
      );
    });
  });

  describe("base64Encoder", () => {
    it("should use the provided base64Encoder to encode the digest", async () => {
      const base64Encoder = vi.fn().mockReturnValue(canonicalBase64);
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
        base64Encoder,
      });

      await collect(checksumStream);

      expect(base64Encoder).toHaveBeenCalledTimes(1);
    });

    it("should compare against the encoder output when reporting a mismatch", async () => {
      const base64Encoder = vi.fn().mockReturnValue("encoder-output");
      const checksumStream = new ChecksumStream({
        expectedChecksum: "expected",
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
        base64Encoder,
      });

      await expect(collect(checksumStream)).rejects.toThrow(
        `Checksum mismatch: expected "expected" but received "encoder-output" in response header "my-header".`
      );
    });

    it("should default to toBase64 when no encoder is provided", async () => {
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
      });

      // A matching result implies the digest was base64-encoded with the default toBase64.
      const collected = toUtf8(await collect(checksumStream));
      expect(collected).toEqual(canonicalUtf8);
    });
  });

  describe("error propagation", () => {
    it("should surface errors thrown by checksum.update", async () => {
      const checksum = new Appender();
      vi.spyOn(checksum, "update").mockImplementation(() => {
        throw new Error("update failed");
      });
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum,
        checksumSourceLocation: "my-header",
        source: makeSource(),
      });

      await expect(collect(checksumStream)).rejects.toThrow("update failed");
    });

    it("should surface errors thrown by checksum.digest", async () => {
      const checksum = new Appender();
      vi.spyOn(checksum, "digest").mockRejectedValue(new Error("digest failed"));
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum,
        checksumSourceLocation: "my-header",
        source: makeSource(),
      });

      await expect(collect(checksumStream)).rejects.toThrow("digest failed");
    });

    it("should surface an error emitted by the source", async () => {
      const source = makeSource();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source,
      });

      const sourceError = new Error("source failure");
      const streamError = new Promise<Error>((resolve) => checksumStream.once("error", resolve));

      source.emit("error", sourceError);

      expect(await streamError).toBe(sourceError);
      expect(checksumStream.destroyed).toBe(true);
      expect(source.destroyed).toBe(true);
    });
  });

  describe("lazy start", () => {
    it("should not read from the source until the stream is consumed", async () => {
      const checksum = new Appender();
      const updateSpy = vi.spyOn(checksum, "update");
      const source = makeSource();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum,
        checksumSourceLocation: "my-header",
        source,
      });

      // The source is paused on construction and no chunk is processed until read.
      expect(source.isPaused()).toBe(true);
      await new Promise((r) => setTimeout(r, 50));
      expect(updateSpy).not.toHaveBeenCalled();

      // Reading the stream is what drives consumption of the source.
      const ait = checksumStream[Symbol.asyncIterator]();
      await ait.next();
      expect(updateSpy).toHaveBeenCalled();

      checksumStream.destroy();
    });
  });

  describe("_destroy", () => {
    it("should destroy the upstream source when destroyed", () => {
      const source = makeSource();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source,
      });

      checksumStream.destroy();

      expect(checksumStream.destroyed).toBe(true);
      expect(source.destroyed).toBe(true);
    });

    it("should surface the error on itself, not the source, when destroyed with an error", async () => {
      const source = makeSource();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source,
      });

      const error = new Error("boom");
      const streamError = new Promise<Error>((resolve) => checksumStream.once("error", resolve));
      let sourceErrored = false;
      source.once("error", () => {
        sourceErrored = true;
      });

      checksumStream.destroy(error);

      expect(await streamError).toBe(error);
      expect(sourceErrored).toBe(false);
      expect(checksumStream.destroyed).toBe(true);
      expect(source.destroyed).toBe(true);
    });
  });

  describe("backpressure", () => {
    it("should only read from the source at the rate it is consumed", async () => {
      // for Node.js 22+ increased default highwater mark.
      Readable.setDefaultHighWaterMark(false, 16_384);
      let originalStreamBuffered = 0;
      const source = Readable.from(
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
      const checksumStream = new ChecksumStream({
        expectedChecksum: toBase64(new Uint8Array()),
        checksum: {
          async digest() {
            return new Uint8Array();
          },
          update: () => {},
          reset: () => {},
        },
        checksumSourceLocation: "my-header",
        source,
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
});
