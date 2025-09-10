import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect,test as it, vi } from "vitest";
import { createGzip } from "zlib";

import { compressStream } from "./compressStream";

vi.mock("zlib");

describe(compressStream.name, () => {
  const getGenerator = (chunks: string[]) =>
    async function* generator() {
      for (const chunk of chunks) {
        yield chunk;
      }
    };

  const testInputStream = Readable.from(getGenerator(["input"])());
  const mockGzipFn = vi.fn();
  const testOutputStream = Readable.from(getGenerator(["input", "gzipped"])());

  beforeEach(() => {
    (vi.mocked(createGzip)).mockReturnValue(mockGzipFn as any);
    testInputStream.pipe = vi.fn().mockReturnValue(testOutputStream);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should compress a readable stream using gzip", async () => {
    const outputStream = await compressStream(testInputStream);

    expect(outputStream).toBeInstanceOf(Readable);
    expect(outputStream).toBe(testOutputStream);

    expect(testInputStream.pipe).toHaveBeenCalledTimes(1);
    expect(testInputStream.pipe).toHaveBeenCalledWith(mockGzipFn);
    expect(createGzip).toHaveBeenCalledTimes(1);
  });

  it("should throw an error if compression fails", async () => {
    const compressionErrorMsg = "compression error message";
    const compressionError = new Error(compressionErrorMsg);
    (vi.mocked(createGzip)).mockImplementationOnce(() => {
      throw compressionError;
    });

    await expect(compressStream(testInputStream)).rejects.toThrow(compressionError);

    expect(createGzip).toHaveBeenCalledTimes(1);
    expect(testInputStream.pipe).not.toHaveBeenCalled();
  });
});
