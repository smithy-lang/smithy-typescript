import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { getAwsChunkedEncodingStream } from "./getAwsChunkedEncodingStream";

describe(getAwsChunkedEncodingStream.name, () => {
  const mockBase64Encoder = vi.fn();
  const mockBodyLengthChecker = vi.fn();
  const mockChecksumAlgorithmFn = vi.fn();
  const mockChecksumLocationName = "mockChecksumLocationName";
  const mockStreamHasher = vi.fn();

  const mockOptions = {
    base64Encoder: mockBase64Encoder,
    bodyLengthChecker: mockBodyLengthChecker,
    checksumAlgorithmFn: mockChecksumAlgorithmFn,
    checksumLocationName: mockChecksumLocationName,
    streamHasher: mockStreamHasher,
  };

  const mockChecksum = "mockChecksum";
  const mockRawChecksum = Buffer.from(mockChecksum);
  const mockStreamChunks = ["Hello", "World"];
  const mockBodyLength = 5;

  const getMockReadableStream = () => {
    const readableStream = new Readable();
    mockStreamChunks.forEach((chunk) => {
      readableStream.push(chunk);
    });
    readableStream.push(null);
    return readableStream;
  };

  beforeEach(() => {
    mockStreamHasher.mockResolvedValue(mockRawChecksum);
    mockBase64Encoder.mockReturnValue(mockChecksum);
  });

  describe("mock stream", () => {
    beforeEach(() => {
      mockBodyLengthChecker.mockReturnValue(mockBodyLength);
    });

    afterEach(() => {
      expect(mockBodyLengthChecker).toHaveBeenCalledTimes(mockStreamChunks.length);
      mockStreamChunks.forEach((chunk, index) => {
        expect(mockBodyLengthChecker).toHaveBeenNthCalledWith(index + 1, Buffer.from(chunk));
      });
      vi.clearAllMocks();
    });

    describe("skips checksum computation", () => {
      const validateStreamWithoutChecksum = async (awsChunkedEncodingStream: Readable) => {
        let buffer = "";
        let resolve: Function;
        const promise = new Promise((r) => (resolve = r));
        awsChunkedEncodingStream.on("data", (data) => {
          buffer += data.toString();
        });
        awsChunkedEncodingStream.on("end", () => {
          expect(mockStreamHasher).not.toHaveBeenCalled();
          expect(mockBase64Encoder).not.toHaveBeenCalled();
          expect(buffer).toEqual(`5\r
Hello\r
5\r
World\r
0\r
\r
`);
          resolve();
        });
        await promise;
      };

      it("if none of the required options are passed", async () => {
        const readableStream = getMockReadableStream();
        const awsChunkedEncodingStream = getAwsChunkedEncodingStream(readableStream, {
          bodyLengthChecker: mockBodyLengthChecker,
        });
        await validateStreamWithoutChecksum(awsChunkedEncodingStream);
      });

      ["base64Encoder", "checksumAlgorithmFn", "checksumLocationName", "streamHasher"].forEach((optionToRemove) => {
        it(`if option '${optionToRemove}' is not passed`, async () => {
          const readableStream = getMockReadableStream();
          const awsChunkedEncodingStream = getAwsChunkedEncodingStream(readableStream, {
            ...mockOptions,
            [optionToRemove]: undefined,
          });
          await validateStreamWithoutChecksum(awsChunkedEncodingStream);
        });
      });
    });

    it("computes checksum and adds it to the end event", async () => {
      const readableStream = getMockReadableStream();
      const awsChunkedEncodingStream = getAwsChunkedEncodingStream(readableStream, mockOptions);
      let resolve: Function;
      const promise = new Promise((r) => (resolve = r));
      let buffer = "";
      awsChunkedEncodingStream.on("data", (data) => {
        buffer += data.toString();
      });
      awsChunkedEncodingStream.on("end", () => {
        expect(mockStreamHasher).toHaveBeenCalledWith(mockChecksumAlgorithmFn, readableStream);
        expect(mockBase64Encoder).toHaveBeenCalledWith(mockRawChecksum);
        expect(buffer).toStrictEqual(`5\r
Hello\r
5\r
World\r
0\r
mockChecksumLocationName:mockChecksum\r
\r
`);
        resolve();
      });
      await promise;
    });
  });

  it("does not emit chunks of zero length", async () => {
    const readableStream = Readable.from({
      async *[Symbol.asyncIterator]() {
        yield "";
        yield "";
        yield "";
        yield "";
      },
    });
    const awsChunkedEncodingStream = getAwsChunkedEncodingStream(readableStream, {
      ...mockOptions,
      bodyLengthChecker: () => 0,
    });
    let resolve: Function;
    const promise = new Promise((r) => (resolve = r));
    let buffer = "";
    awsChunkedEncodingStream.on("data", (data) => {
      buffer += data.toString();
    });
    awsChunkedEncodingStream.on("end", () => {
      expect(mockStreamHasher).toHaveBeenCalledWith(mockChecksumAlgorithmFn, readableStream);
      expect(mockBase64Encoder).toHaveBeenCalledWith(mockRawChecksum);
      expect(buffer).toStrictEqual(`0\r
mockChecksumLocationName:mockChecksum\r
\r
`);
      resolve();
    });
    await promise;
  });

  describe("stream lifecycle", () => {
    it("forwards a source error as an 'error' event instead of hanging", async () => {
      const source = Readable.from(
        (async function* () {
          yield "partial";
          throw new Error("source failed");
        })()
      );
      // The hasher rejects when the source errors, mirroring readableStreamHasher.
      const rejectingHasher = vi.fn().mockRejectedValue(new Error("source failed"));
      const awsChunkedEncodingStream = getAwsChunkedEncodingStream(source, {
        ...mockOptions,
        bodyLengthChecker: (c: any) => (c ? c.length : 0),
        streamHasher: rejectingHasher,
      });

      const error = await new Promise<Error>((resolve, reject) => {
        awsChunkedEncodingStream.on("error", resolve);
        awsChunkedEncodingStream.on("end", () => reject(new Error("expected 'error', got 'end'")));
        awsChunkedEncodingStream.resume();
      });
      expect(error.message).toBe("source failed");
    });

    it("surfaces a post-end digest rejection as an 'error' event", async () => {
      const readableStream = getMockReadableStream();
      const rejectingHasher = vi.fn().mockRejectedValue(new Error("digest failed"));
      const awsChunkedEncodingStream = getAwsChunkedEncodingStream(readableStream, {
        ...mockOptions,
        bodyLengthChecker: () => mockBodyLength,
        streamHasher: rejectingHasher,
      });

      const error = await new Promise<Error>((resolve, reject) => {
        awsChunkedEncodingStream.on("error", resolve);
        awsChunkedEncodingStream.on("end", () => reject(new Error("expected 'error', got 'end'")));
        awsChunkedEncodingStream.resume();
      });
      expect(error.message).toBe("digest failed");
    });

    it("honors backpressure and does not drain the source without demand", async () => {
      let generated = 0;
      const chunkSize = 64 * 1024;
      const source = Readable.from(
        (async function* () {
          for (let i = 0; i < 512; i++) {
            generated++;
            yield Buffer.alloc(chunkSize);
          }
        })()
      );
      const awsChunkedEncodingStream = getAwsChunkedEncodingStream(source, {
        bodyLengthChecker: (c: any) => (c ? c.length : 0),
      });

      // Never read from the encoded stream; give it time to (not) drain.
      await new Promise((r) => setTimeout(r, 100));

      // Without backpressure this would be 512 (full drain) and the buffer
      // would hold the entire ~32 MiB body. With backpressure, consumption
      // stops well before the source is exhausted.
      expect(generated).toBeLessThan(512);
      expect(awsChunkedEncodingStream.readableLength).toBeLessThan(512 * chunkSize);
      awsChunkedEncodingStream.destroy();
    });
  });
});
