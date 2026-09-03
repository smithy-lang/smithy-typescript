import { Readable } from "node:stream";
import type { Checksum } from "@smithy/types";
import { describe, expect, test as it, vi } from "vitest";

import { toBase64 } from "../../util-base64/toBase64";
import { toUtf8 } from "../../util-utf8/toUtf8";
import { ChecksumMismatchError } from "./ChecksumMismatchError";
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
   * A source that emits each byte as its own chunk, so that chunk-level
   * behaviour such as hold-back is observable.
   */
  const makeChunkedSource = () => Readable.from(Array.from(canonicalData, (byte) => Buffer.from([byte])));

  /**
   * A source that is driven explicitly by the test and does not end until it is
   * told to. Necessary because Readable.from() over an in-memory array reaches
   * its end as soon as it is resumed, which would settle validation before a
   * test could observe the intermediate state.
   */
  const makeManualSource = () => new Readable({ read() {} });

  /**
   * Yield to the event loop so that stream events are delivered.
   */
  const tick = () => new Promise((r) => setTimeout(r, 10));

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
    it("should report FAILED when checksum.update throws", async () => {
      const error = new Error("update failed");
      const checksum = new Appender();
      vi.spyOn(checksum, "update").mockImplementation(() => {
        throw error;
      });
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum,
        checksumSourceLocation: "my-header",
        source: makeSource(),
        algorithm: "CRC32",
        checksumSource: "STREAM",
        onResult,
      });

      await expect(collect(checksumStream)).rejects.toBe(error);

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "FAILED",
        validationPerformed: false,
        validationAlgorithm: "CRC32",
        source: "STREAM",
      });
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

  describe("premature close propagation", () => {
    it("should error when the source is destroyed mid-transfer (dropped connection)", async () => {
      const source = new Readable({
        read() {
          this.push(Buffer.from("partial"));
          this.destroy();
        },
      });

      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source,
      });

      await expect(collect(checksumStream)).rejects.toThrow(
        "Connection lost or stream closed before all data was received."
      );
    });

    it("should error when the source is destroyed by external caller", async () => {
      const manualSource = new Readable({ read() {} });
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: manualSource,
      });

      const errorPromise = new Promise<Error>((resolve) => checksumStream.once("error", resolve));

      manualSource.push(Buffer.from("partial-data"));
      manualSource.destroy();

      const error = await errorPromise;
      expect(error.message).toContain("Connection lost or stream closed before all data was received.");
      expect(checksumStream.destroyed).toBe(true);
    });

    it("should error when the source is destroyed by external caller (async)", async () => {
      const manualSource = new Readable({ read() {} });
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: manualSource,
      });

      manualSource.push(Buffer.from("some-data"));
      setTimeout(() => manualSource.destroy(), 50);

      await expect(collect(checksumStream)).rejects.toThrow(
        "Connection lost or stream closed before all data was received."
      );
    });
  });

  describe("ChecksumMismatchError", () => {
    it("should throw a ChecksumMismatchError carrying the structured fields", async () => {
      const checksumStream = new ChecksumStream({
        expectedChecksum: "different-expected-checksum",
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
        algorithm: "CRC32",
        checksumSource: "STREAM",
      });

      const error = await collect(checksumStream).then(
        () => {
          throw new Error("stream was read successfully");
        },
        (e) => e as ChecksumMismatchError
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ChecksumMismatchError);
      expect(error.name).toEqual("ChecksumMismatchError");
      expect(error.algorithm).toEqual("CRC32");
      expect(error.source).toEqual("STREAM");
      // The wire value, versus the value calculated locally.
      expect(error.receivedChecksum).toEqual("different-expected-checksum");
      expect(error.calculatedChecksum).toEqual(canonicalBase64);
      expect(error.sourceLocation).toEqual("my-header");
      // Not retryable: a second successful response would mask the failure.
      expect("$retryable" in error).toBe(false);
    });

    it("should round-trip through toJSON for transfer across a worker boundary", async () => {
      const checksumStream = new ChecksumStream({
        expectedChecksum: "different-expected-checksum",
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
        algorithm: "CRC64NVME",
        checksumSource: "STORED",
      });

      const error = await collect(checksumStream).then(
        () => {
          throw new Error("stream was read successfully");
        },
        (e) => e as ChecksumMismatchError
      );

      const transferred = JSON.parse(JSON.stringify(error));
      const reconstructed = new ChecksumMismatchError(transferred);

      expect(reconstructed.name).toEqual(error.name);
      expect(reconstructed.message).toEqual(error.message);
      expect(reconstructed.algorithm).toEqual("CRC64NVME");
      expect(reconstructed.source).toEqual("STORED");
      expect(reconstructed.receivedChecksum).toEqual(error.receivedChecksum);
      expect(reconstructed.calculatedChecksum).toEqual(error.calculatedChecksum);
    });
  });

  describe("deferred expected checksum", () => {
    it("should not call the provider until the source reaches its end", async () => {
      const expectedChecksum = vi.fn().mockResolvedValue(toBase64("ab"));
      const source = makeManualSource();
      const checksumStream = new ChecksumStream({
        expectedChecksum,
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source,
      });

      checksumStream.resume();
      source.push(Buffer.from("a"));
      await tick();
      // Data has flowed but the source has not ended, so no comparison is due.
      expect(expectedChecksum).not.toHaveBeenCalled();

      source.push(Buffer.from("b"));
      source.push(null);
      await tick();
      expect(expectedChecksum).toHaveBeenCalledTimes(1);
    });

    it("should compare against the provider's value", async () => {
      const checksumStream = new ChecksumStream({
        expectedChecksum: () => Promise.resolve(canonicalBase64),
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source: makeSource(),
      });

      expect(toUtf8(await collect(checksumStream))).toEqual(canonicalUtf8);
    });

    it("should report a mismatch against the provider's value", async () => {
      const expected = toBase64("trailer-value");
      const checksumStream = new ChecksumStream({
        expectedChecksum: () => Promise.resolve(expected),
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source: makeSource(),
      });

      await expect(collect(checksumStream)).rejects.toThrow(
        `Checksum mismatch: expected "${expected}" but received "${canonicalBase64}"` +
          ` in response header "x-amz-trailer".`
      );
    });

    it("should surface an error thrown by the provider", async () => {
      const checksumStream = new ChecksumStream({
        expectedChecksum: () => Promise.reject(new Error("trailer never arrived")),
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source: makeSource(),
      });

      await expect(collect(checksumStream)).rejects.toThrow("trailer never arrived");
    });
  });

  describe("holdBackLastChunk", () => {
    it("should withhold the most recent chunk until the comparison succeeds", async () => {
      const source = makeManualSource();
      const checksumStream = new ChecksumStream({
        expectedChecksum: toBase64("abc"),
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source,
        holdBackLastChunk: true,
      });

      // Begin reading so the source is resumed.
      expect(checksumStream.read()).toBe(null);

      source.push(Buffer.from("a"));
      await tick();
      // The only chunk seen so far is withheld, so nothing is readable.
      expect(checksumStream.read()).toBe(null);

      source.push(Buffer.from("b"));
      await tick();
      // "a" is released now that a newer chunk is being withheld.
      expect(checksumStream.read()?.toString()).toEqual("a");

      source.push(Buffer.from("c"));
      await tick();
      expect(checksumStream.read()?.toString()).toEqual("b");

      source.push(null);
      await tick();
      // The final withheld chunk is released once the checksum matches.
      expect(checksumStream.read()?.toString()).toEqual("c");

      await tick();
      expect(checksumStream.read()).toBe(null);
      await tick();
      expect(checksumStream.readableEnded).toBe(true);
    });

    it("should deliver all bytes by the end of a successful stream", async () => {
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeChunkedSource(),
        holdBackLastChunk: true,
      });

      expect(toUtf8(await collect(checksumStream))).toEqual(canonicalUtf8);
    });

    it("should discard the withheld chunk when the checksum does not match", async () => {
      const checksumStream = new ChecksumStream({
        expectedChecksum: "different-expected-checksum",
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeChunkedSource(),
        holdBackLastChunk: true,
      });

      const seen: number[] = [];
      await expect(
        (async () => {
          for await (const chunk of checksumStream) {
            seen.push(...chunk);
          }
        })()
      ).rejects.toThrow(/Checksum mismatch/);

      /**
       * The withheld final byte was never delivered. Everything delivered is a
       * prefix of the preceding bytes: destroying the stream discards whatever
       * is still in its readable buffer, and how much that is depends on the
       * consumer's read granularity, which is not the same across Node
       * versions. Node 26 changed read() without a size to return one buffered
       * chunk rather than the whole buffer concatenated, so the amount that
       * reaches the consumer before the mismatch is not asserted here.
       * @see https://github.com/nodejs/node/pull/60441
       */
      const delivered = toUtf8(new Uint8Array(seen));
      expect(canonicalUtf8.slice(0, 25).startsWith(delivered)).toBe(true);
      expect(delivered).not.toContain("z");
    });

    it("should compare without a withheld chunk for an empty payload", async () => {
      const onResult = vi.fn();
      const emptyDigest = toBase64("");
      const checksumStream = new ChecksumStream({
        expectedChecksum: emptyDigest,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: Readable.from([]),
        holdBackLastChunk: true,
        onResult,
      });

      expect(await collect(checksumStream)).toEqual(new Uint8Array());
      expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: "SUCCEEDED" }));
    });
  });

  describe("onResult", () => {
    it("should report FAILED for a source deserialization error", async () => {
      const sourceError = new Error("decoder failed");
      const source = makeManualSource();
      const isProtocolError = vi.fn((error: unknown) => error === sourceError);
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source,
        algorithm: "CRC32",
        checksumSource: "STREAM",
        isProtocolError,
        onResult,
      });
      const streamError = new Promise<Error>((resolve) => checksumStream.once("error", resolve));

      source.emit("error", sourceError);

      expect(await streamError).toBe(sourceError);
      expect(isProtocolError).toHaveBeenCalledTimes(1);
      expect(isProtocolError).toHaveBeenCalledWith(sourceError);
      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "FAILED",
        validationPerformed: false,
        validationAlgorithm: "CRC32",
        source: "STREAM",
      });
    });

    it("should report INCOMPLETE for a transport source error", async () => {
      const sourceError = new Error("socket reset");
      const source = makeManualSource();
      const isProtocolError = vi.fn(() => false);
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source,
        algorithm: "CRC32",
        checksumSource: "STREAM",
        isProtocolError,
        onResult,
      });
      const streamError = new Promise<Error>((resolve) => checksumStream.once("error", resolve));

      source.emit("error", sourceError);

      expect(await streamError).toBe(sourceError);
      expect(isProtocolError).toHaveBeenCalledTimes(1);
      expect(isProtocolError).toHaveBeenCalledWith(sourceError);
      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "INCOMPLETE",
        validationPerformed: false,
        validationAlgorithm: "CRC32",
        source: "STREAM",
      });
    });

    it("should report a malformed deferred Base64 value as a deserialization failure", async () => {
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: () => Promise.resolve("!!!!"),
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source: makeSource(),
        algorithm: "CRC32",
        checksumSource: "STREAM",
        onResult,
      });

      const error = await collect(checksumStream).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(TypeError);
      expect(error).not.toBeInstanceOf(ChecksumMismatchError);
      expect(error).toMatchObject({ message: "Invalid base64 string." });
      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "FAILED",
        validationPerformed: false,
        validationAlgorithm: "CRC32",
        source: "STREAM",
      });
    });

    it("should report an empty deferred Base64 value as a mismatch", async () => {
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: () => Promise.resolve(""),
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source: makeSource(),
        algorithm: "CRC32",
        checksumSource: "STREAM",
        onResult,
      });

      const error = await collect(checksumStream).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ChecksumMismatchError);
      expect(error).toMatchObject({
        receivedChecksum: "",
        calculatedChecksum: canonicalBase64,
      });
      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "FAILED",
        validationPerformed: true,
        validationAlgorithm: "CRC32",
        source: "STREAM",
        receivedChecksum: "",
        calculatedChecksum: canonicalBase64,
      });
    });

    it("should report exactly one INCOMPLETE result when cancelled while the provider is pending", async () => {
      let resolveExpectedChecksum: (value: string) => void = () => {};
      const expectedChecksum = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveExpectedChecksum = resolve;
          })
      );
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum,
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source: makeSource(),
        algorithm: "CRC32",
        checksumSource: "STREAM",
        onResult,
      });
      checksumStream.resume();

      await tick();
      expect(expectedChecksum).toHaveBeenCalledTimes(1);

      checksumStream.destroy();
      await tick();

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "INCOMPLETE",
        validationPerformed: false,
        validationAlgorithm: "CRC32",
        source: "STREAM",
      });

      resolveExpectedChecksum(canonicalBase64);
      await tick();

      expect(onResult).toHaveBeenCalledTimes(1);
    });

    it("should report SUCCEEDED with the algorithm, source and both values", async () => {
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
        algorithm: "CRC32",
        checksumSource: "STREAM",
        onResult,
      });

      await collect(checksumStream);

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
      const checksumStream = new ChecksumStream({
        expectedChecksum: "different-expected-checksum",
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
        algorithm: "CRC32C",
        checksumSource: "STORED",
        onResult,
      });

      await expect(collect(checksumStream)).rejects.toThrow(/Checksum mismatch/);

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "FAILED",
        validationPerformed: true,
        validationAlgorithm: "CRC32C",
        source: "STORED",
        receivedChecksum: "different-expected-checksum",
        calculatedChecksum: canonicalBase64,
      });
    });

    it("should report FAILED without a comparison when the provider rejects", async () => {
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: () => Promise.reject(new Error("trailer never arrived")),
        checksum: new Appender(),
        checksumSourceLocation: "x-amz-trailer",
        source: makeSource(),
        algorithm: "CRC32",
        checksumSource: "STREAM",
        onResult,
      });

      await expect(collect(checksumStream)).rejects.toThrow("trailer never arrived");

      expect(onResult).toHaveBeenCalledWith({
        status: "FAILED",
        validationPerformed: false,
        validationAlgorithm: "CRC32",
        source: "STREAM",
      });
    });

    it("should report FAILED without a comparison when checksum.digest rejects", async () => {
      const error = new Error("digest failed");
      const checksum = new Appender();
      vi.spyOn(checksum, "digest").mockRejectedValue(error);
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum,
        checksumSourceLocation: "my-header",
        source: makeSource(),
        algorithm: "CRC32",
        checksumSource: "STORED",
        onResult,
      });

      await expect(collect(checksumStream)).rejects.toBe(error);

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "FAILED",
        validationPerformed: false,
        validationAlgorithm: "CRC32",
        source: "STORED",
      });
    });

    it("should report FAILED without a comparison when the Base64 encoder throws", async () => {
      const error = new Error("encoding failed");
      const base64Encoder = vi.fn((_input: Uint8Array): string => {
        throw error;
      });
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
        base64Encoder,
        algorithm: "CRC32",
        checksumSource: "STORED",
        onResult,
      });

      await expect(collect(checksumStream)).rejects.toBe(error);

      expect(base64Encoder).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "FAILED",
        validationPerformed: false,
        validationAlgorithm: "CRC32",
        source: "STORED",
      });
    });

    it("should report INCOMPLETE when the stream is destroyed before the end", async () => {
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeChunkedSource(),
        algorithm: "CRC32",
        checksumSource: "STREAM",
        onResult,
      });

      checksumStream.destroy();
      await new Promise((r) => setTimeout(r, 10));

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({
        status: "INCOMPLETE",
        validationPerformed: false,
        validationAlgorithm: "CRC32",
        source: "STREAM",
      });
    });

    it("should report INCOMPLETE when consumption stops early", async () => {
      const onResult = vi.fn();
      const source = makeManualSource();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source,
        onResult,
      });

      source.push(Buffer.from("partial"));

      // Breaking out of a for-await loop destroys the stream. The source has
      // more to send, so the comparison never runs.
      for await (const _chunk of checksumStream) {
        break;
      }
      await tick();

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({ status: "INCOMPLETE", validationPerformed: false })
      );
    });

    it("should report INCOMPLETE when the source closes prematurely", async () => {
      const onResult = vi.fn();
      const source = new Readable({
        read() {
          this.push(Buffer.from("partial"));
          this.destroy();
        },
      });
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source,
        onResult,
      });

      await expect(collect(checksumStream)).rejects.toThrow(
        "Connection lost or stream closed before all data was received."
      );

      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({ status: "INCOMPLETE", validationPerformed: false })
      );
    });

    it("should stay pending when the stream is abandoned without being destroyed", async () => {
      const onResult = vi.fn();
      const source = makeManualSource();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source,
        onResult,
      });

      // Read a single chunk, then stop without cancelling or destroying.
      await new Promise<void>((resolve) => {
        checksumStream.once("data", () => {
          checksumStream.pause();
          resolve();
        });
        source.push(Buffer.from("partial"));
      });
      await new Promise((r) => setTimeout(r, 50));

      // Validation cannot be settled: the consumer may still resume.
      expect(onResult).not.toHaveBeenCalled();

      checksumStream.destroy();
    });

    it("should report a result at most once", async () => {
      const onResult = vi.fn();
      const checksumStream = new ChecksumStream({
        expectedChecksum: canonicalBase64,
        checksum: new Appender(),
        checksumSourceLocation: "my-header",
        source: makeSource(),
        onResult,
      });

      await collect(checksumStream);
      // Destroying after a successful end must not overwrite the result.
      checksumStream.destroy();
      await new Promise((r) => setTimeout(r, 10));

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: "SUCCEEDED" }));
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
