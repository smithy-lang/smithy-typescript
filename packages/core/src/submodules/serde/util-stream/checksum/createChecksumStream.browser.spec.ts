import type { Checksum } from "@smithy/types";
import { describe, expect, test as it, vi } from "vitest";

import { toBase64 } from "../../util-base64/toBase64";
import { toUtf8 } from "../../util-utf8/toUtf8";
import { headStream } from "../headStream.browser";
import { ChecksumStream as ChecksumStreamWeb } from "./ChecksumStream.browser";
import { createChecksumStream } from "./createChecksumStream.browser";

(typeof ReadableStream === "function" && process.version >= "v18" ? describe : describe.skip)(
  "Checksum streams",
  () => {
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

    describe(createChecksumStream.name + " webstreams API", () => {
      if (typeof ReadableStream !== "function") {
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
            `ChecksumMismatchError: Checksum mismatch: expected "different-expected-checksum" but` +
              ` received "${canonicalBase64}"` +
              ` in response header "my-header".`
          );
        }
      });

      it("should throw a ChecksumMismatchError carrying the structured fields", async () => {
        const checksumStream = createChecksumStream({
          expectedChecksum: "different-expected-checksum",
          checksum: new Appender(),
          checksumSourceLocation: "my-header",
          source: makeStream(),
          algorithm: "CRC32",
          checksumSource: "STREAM",
        });

        await expect(headStream(checksumStream, Infinity)).rejects.toMatchObject({
          name: "ChecksumMismatchError",
          code: "CHECKSUM_MISMATCH",
          algorithm: "CRC32",
          source: "STREAM",
          receivedChecksum: "different-expected-checksum",
          calculatedChecksum: canonicalBase64,
          sourceLocation: "my-header",
        });
      });

      describe("deferred expected checksum", () => {
        it("should resolve the expected value from a provider at end of stream", async () => {
          const expectedChecksum = vi.fn().mockResolvedValue(canonicalBase64);
          const checksumStream = createChecksumStream({
            expectedChecksum,
            checksum: new Appender(),
            checksumSourceLocation: "x-amz-trailer",
            source: makeStream(),
          });

          expect(expectedChecksum).not.toHaveBeenCalled();

          const collected = toUtf8(await headStream(checksumStream, Infinity));
          expect(collected).toEqual(canonicalUtf8);
          expect(expectedChecksum).toHaveBeenCalledTimes(1);
        });

        it("should surface an error thrown by the provider", async () => {
          const checksumStream = createChecksumStream({
            expectedChecksum: () => Promise.reject(new Error("trailer never arrived")),
            checksum: new Appender(),
            checksumSourceLocation: "x-amz-trailer",
            source: makeStream(),
          });

          await expect(headStream(checksumStream, Infinity)).rejects.toThrow("trailer never arrived");
        });
      });

      describe("holdBackLastChunk", () => {
        it("should not deliver the final chunk until the comparison succeeds", async () => {
          const checksumStream = createChecksumStream({
            expectedChecksum: canonicalBase64,
            checksum: new Appender(),
            checksumSourceLocation: "my-header",
            source: makeStream(),
            holdBackLastChunk: true,
          });

          const reader = checksumStream.getReader();
          const seen: number[] = [];
          for (let i = 0; i < 25; ++i) {
            const { value } = await reader.read();
            seen.push(...value);
          }
          // 25 of 26 single-byte chunks are readable while the last is withheld.
          expect(seen).toHaveLength(25);
          expect(toUtf8(new Uint8Array(seen))).toEqual(canonicalUtf8.slice(0, 25));

          // The withheld chunk is released once the checksum matches.
          const { value: last } = await reader.read();
          expect(toUtf8(last)).toEqual("z");
          expect((await reader.read()).done).toBe(true);
        });

        it("should never deliver the final chunk when the checksum does not match", async () => {
          const checksumStream = createChecksumStream({
            expectedChecksum: "different-expected-checksum",
            checksum: new Appender(),
            checksumSourceLocation: "my-header",
            source: makeStream(),
            holdBackLastChunk: true,
          });

          const reader = checksumStream.getReader();
          const seen: number[] = [];
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                throw new Error("stream was read successfully");
              }
              seen.push(...value);
            }
          } catch (e: unknown) {
            expect((e as Error).name).toEqual("ChecksumMismatchError");
          }
          // The final byte was discarded rather than delivered.
          expect(toUtf8(new Uint8Array(seen))).toEqual(canonicalUtf8.slice(0, 25));
        });

        it("should retain the final non-empty chunk when followed by an empty chunk", async () => {
          const source = new ReadableStream({
            start(controller) {
              controller.enqueue(canonicalData);
              controller.enqueue(new Uint8Array(0));
              controller.close();
            },
          });
          const checksumStream = createChecksumStream({
            expectedChecksum: "different-expected-checksum",
            checksum: new Appender(),
            checksumSourceLocation: "my-header",
            source,
            holdBackLastChunk: true,
          });

          const reader = checksumStream.getReader();
          const seen: number[] = [];
          const readAll = async () => {
            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                return;
              }
              seen.push(...value);
            }
          };

          await expect(readAll()).rejects.toHaveProperty("name", "ChecksumMismatchError");
          expect(seen).toEqual([]);
        });
      });

      describe("onResult", () => {
        it("should report SUCCEEDED with the algorithm and source", async () => {
          const onResult = vi.fn();
          const checksumStream = createChecksumStream({
            expectedChecksum: canonicalBase64,
            checksum: new Appender(),
            checksumSourceLocation: "my-header",
            source: makeStream(),
            algorithm: "CRC32",
            checksumSource: "STREAM",
            onResult,
          });

          await headStream(checksumStream, Infinity);

          expect(onResult).toHaveBeenCalledTimes(1);
          expect(onResult).toHaveBeenCalledWith({
            status: "SUCCEEDED",
            validationPerformed: true,
            validationAlgorithm: "CRC32",
            source: "STREAM",
            receivedChecksum: canonicalBase64,
            calculatedChecksum: canonicalBase64,
          });
        });

        it("should report FAILED with both checksum values on a mismatch", async () => {
          const onResult = vi.fn();
          const checksumStream = createChecksumStream({
            expectedChecksum: "different-expected-checksum",
            checksum: new Appender(),
            checksumSourceLocation: "my-header",
            source: makeStream(),
            algorithm: "CRC32",
            checksumSource: "STORED",
            onResult,
          });

          await expect(headStream(checksumStream, Infinity)).rejects.toThrow(/Checksum mismatch/);

          expect(onResult).toHaveBeenCalledTimes(1);
          expect(onResult).toHaveBeenCalledWith({
            status: "FAILED",
            validationPerformed: true,
            validationAlgorithm: "CRC32",
            source: "STORED",
            receivedChecksum: "different-expected-checksum",
            calculatedChecksum: canonicalBase64,
          });
        });

        it("should report FAILED without a comparison when the provider rejects", async () => {
          const onResult = vi.fn();
          const checksumStream = createChecksumStream({
            expectedChecksum: () => Promise.reject(new Error("trailer never arrived")),
            checksum: new Appender(),
            checksumSourceLocation: "x-amz-trailer",
            source: makeStream(),
            algorithm: "CRC32",
            checksumSource: "STREAM",
            onResult,
          });

          await expect(headStream(checksumStream, Infinity)).rejects.toThrow("trailer never arrived");

          expect(onResult).toHaveBeenCalledWith({
            status: "FAILED",
            validationPerformed: false,
            validationAlgorithm: "CRC32",
            source: "STREAM",
          });
        });

        it("should report INCOMPLETE when checksum.update throws", async () => {
          const error = new Error("checksum update failed");
          const checksum = new Appender();
          vi.spyOn(checksum, "update").mockImplementation(() => {
            throw error;
          });
          const onResult = vi.fn();
          const checksumStream = createChecksumStream({
            expectedChecksum: canonicalBase64,
            checksum,
            checksumSourceLocation: "my-header",
            source: makeStream(),
            algorithm: "CRC32",
            checksumSource: "STREAM",
            onResult,
          });

          await expect(checksumStream.getReader().read()).rejects.toBe(error);

          expect(onResult).toHaveBeenCalledTimes(1);
          expect(onResult).toHaveBeenCalledWith({
            status: "INCOMPLETE",
            validationPerformed: false,
            validationAlgorithm: "CRC32",
            source: "STREAM",
          });
        });

        it("should report INCOMPLETE when the stream is cancelled through a reader", async () => {
          const onResult = vi.fn();
          const checksumStream = createChecksumStream({
            expectedChecksum: canonicalBase64,
            checksum: new Appender(),
            checksumSourceLocation: "my-header",
            source: makeStream(),
            algorithm: "CRC32",
            checksumSource: "STREAM",
            onResult,
          });

          const reader = checksumStream.getReader();
          await reader.read();
          await reader.cancel("consumer stopped");

          expect(onResult).toHaveBeenCalledTimes(1);
          expect(onResult).toHaveBeenCalledWith({
            status: "INCOMPLETE",
            validationPerformed: false,
            validationAlgorithm: "CRC32",
            source: "STREAM",
          });
        });

        it("should report INCOMPLETE when the stream itself is cancelled", async () => {
          const onResult = vi.fn();
          const checksumStream = createChecksumStream({
            expectedChecksum: canonicalBase64,
            checksum: new Appender(),
            checksumSourceLocation: "my-header",
            source: makeStream(),
            onResult,
          });

          await checksumStream.cancel("consumer stopped");

          expect(onResult).toHaveBeenCalledWith(
            expect.objectContaining({ status: "INCOMPLETE", validationPerformed: false })
          );
        });

        it("should stay pending when the stream is abandoned without cancellation", async () => {
          const onResult = vi.fn();
          const checksumStream = createChecksumStream({
            expectedChecksum: canonicalBase64,
            checksum: new Appender(),
            checksumSourceLocation: "my-header",
            source: makeStream(),
            onResult,
          });

          const reader = checksumStream.getReader();
          await reader.read();
          await new Promise((r) => setTimeout(r, 50));

          expect(onResult).not.toHaveBeenCalled();
        });
      });
    });
  }
);
