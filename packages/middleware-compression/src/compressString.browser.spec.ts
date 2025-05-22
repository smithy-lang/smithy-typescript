import { test as it, vi, beforeEach, afterEach, describe, expect } from "vitest";

import { toUint8Array } from "@smithy/util-utf8";
import { gzip } from "fflate";

import { compressString } from "./compressString.browser";

vi.mock("@smithy/util-utf8");
vi.mock("fflate");

describe(compressString.name, () => {
  const testData = "test";
  const compressionSuffix = "compressed";
  const compressionSeparator = ".";

  beforeEach(() => {
    vi.mocked(toUint8Array).mockImplementation((data) => data as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should compress data with gzip", async () => {
    vi.mocked(gzip).mockImplementation(((data: any, callback: any) => {
      callback(null, [data, compressionSuffix].join(compressionSeparator));
    }) as any);
    const receivedOutput = await compressString(testData);
    const expectedOutput = [testData, compressionSuffix].join(compressionSeparator);

    expect(receivedOutput).toEqual(expectedOutput);
    expect(gzip).toHaveBeenCalledTimes(1);
    expect(gzip).toHaveBeenCalledWith(testData, expect.any(Function));
    expect(toUint8Array).toHaveBeenCalledTimes(1);
    expect(toUint8Array).toHaveBeenCalledWith(testData);
  });

  it("should throw an error if compression fails", async () => {
    const compressionErrorMsg = "compression error message";
    const compressionError = new Error(compressionErrorMsg);
    vi.mocked(gzip).mockImplementation(((data: any, callback: any) => {
      callback(compressionError);
    }) as any);

    await expect(compressString(testData)).rejects.toThrow(
      new Error("Failure during compression: " + compressionErrorMsg)
    );

    expect(gzip).toHaveBeenCalledTimes(1);
    expect(gzip).toHaveBeenCalledWith(testData, expect.any(Function));
    expect(toUint8Array).toHaveBeenCalledTimes(1);
    expect(toUint8Array).toHaveBeenCalledWith(testData);
  });
});
