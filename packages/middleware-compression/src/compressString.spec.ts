import { test as it, vi, beforeEach, afterEach, describe, expect } from "vitest";

import { toUint8Array } from "@smithy/util-utf8";
import { gzip } from "zlib";

import { compressString } from "./compressString";

const compressionSuffix = "compressed";
const compressionSeparator = ".";

vi.mock("@smithy/util-utf8");
vi.mock("util", () => ({ promisify: vi.fn().mockImplementation((fn) => fn) }));
vi.mock("zlib", () => ({
  gzip: vi.fn().mockImplementation((data) => [data, compressionSuffix].join(compressionSeparator)),
}));

describe(compressString.name, () => {
  const testData = "test";

  beforeEach(() => {
    (vi.mocked(toUint8Array)).mockImplementation((data) => data);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should compress data with gzip", async () => {
    const receivedOutput = await compressString(testData);
    const expectedOutput = [testData, compressionSuffix].join(compressionSeparator);

    expect(receivedOutput).toEqual(expectedOutput);
    expect(gzip).toHaveBeenCalledTimes(1);
    expect(gzip).toHaveBeenCalledWith(testData);
    expect(toUint8Array).toHaveBeenCalledTimes(2);
    expect(toUint8Array).toHaveBeenNthCalledWith(1, testData);
    expect(toUint8Array).toHaveBeenNthCalledWith(2, expectedOutput);
  });

  it("should throw an error if compression fails", async () => {
    const compressionErrorMsg = "compression error message";
    const compressionError = new Error(compressionErrorMsg);
    ((gzip as unknown) as any).mockImplementationOnce(() => {
      throw compressionError;
    });

    await expect(compressString(testData)).rejects.toThrow(
      new Error("Failure during compression: " + compressionErrorMsg)
    );

    expect(gzip).toHaveBeenCalledTimes(1);
    expect(gzip).toHaveBeenCalledWith(testData);
    expect(toUint8Array).toHaveBeenCalledTimes(1);
    expect(toUint8Array).toHaveBeenCalledWith(testData);
  });
});
