import { Readable } from "stream";
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
