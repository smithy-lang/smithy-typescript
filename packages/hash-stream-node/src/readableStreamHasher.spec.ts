import { Hash } from "@smithy/types";
import { Readable, Writable } from "stream";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { HashCalculator } from "./HashCalculator";
import { readableStreamHasher } from "./readableStreamHasher";

vi.mock("./HashCalculator");

describe(readableStreamHasher.name, () => {
  const mockDigest = vi.fn();
  const mockHashCtor = vi.fn().mockImplementation(() => ({
    update: vi.fn(),
    digest: mockDigest,
  }));

  const mockHashCalculatorWrite = vi.fn();
  const mockHashCalculatorEnd = vi.fn();

  const mockHash = new Uint8Array(Buffer.from("mockHash"));

  class MockHashCalculator extends Writable {
    constructor(
      public readonly hash: Hash,
      public readonly mockWrite: any,
      public readonly mockEnd: any
    ) {
      super();
    }

    _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void) {
      this.mockWrite(chunk);
      callback();
    }

    end() {
      this.mockEnd();
      return super.end();
    }
  }

  beforeEach(() => {
    (HashCalculator as unknown as any).mockImplementation(
      (hash: Hash) => new MockHashCalculator(hash, mockHashCalculatorWrite, mockHashCalculatorEnd)
    );
    mockDigest.mockResolvedValue(mockHash);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("computes hash for a readable stream", async () => {
    const readableStream = new Readable({ read: () => {} });
    const hashPromise = readableStreamHasher(mockHashCtor, readableStream);

    // @ts-ignore Property '_readableState' does not exist on type 'Readable'.
    const { pipesCount } = readableStream._readableState;
    expect(pipesCount).toEqual(1);

    const mockDataChunks = ["Hello", "World"];
    setTimeout(() => {
      mockDataChunks.forEach((chunk) => readableStream.emit("data", chunk));
      readableStream.emit("end");
    }, 100);

    expect(await hashPromise).toEqual(mockHash);
    expect(mockHashCalculatorWrite).toHaveBeenCalledTimes(mockDataChunks.length);
    mockDataChunks.forEach((chunk, index) =>
      expect(mockHashCalculatorWrite).toHaveBeenNthCalledWith(index + 1, Buffer.from(chunk))
    );
    expect(mockDigest).toHaveBeenCalledTimes(1);
    expect(mockHashCalculatorEnd).toHaveBeenCalledTimes(1);
  });

  it("throws if readable stream has started reading", async () => {
    const readableStream = new Readable({ read: () => {} });
    // Simulate readableFlowing to true.
    readableStream.resume();

    const expectedError = new Error("Unable to calculate hash for flowing readable stream");
    try {
      readableStreamHasher(mockHashCtor, readableStream);
      fail(`expected ${expectedError}`);
    } catch (error) {
      expect(error).toStrictEqual(expectedError);
    }
  });

  it("throws error if readable stream throws error", async () => {
    const readableStream = new Readable({
      read: () => {},
    });
    const hashPromise = readableStreamHasher(mockHashCtor, readableStream);

    const mockError = new Error("error");
    setTimeout(() => {
      readableStream.emit("error", mockError);
    }, 100);

    try {
      await hashPromise;
      fail(`should throw error ${mockError}`);
    } catch (error) {
      expect(error).toEqual(mockError);
      expect(mockHashCalculatorEnd).toHaveBeenCalledTimes(1);
    }
  });

  it("throws error if HashCalculator throws error", async () => {
    const mockHashCalculator = new MockHashCalculator(
      mockHashCtor as any,
      mockHashCalculatorWrite,
      mockHashCalculatorEnd
    );
    (HashCalculator as unknown as any).mockImplementation(() => mockHashCalculator);

    const readableStream = new Readable({
      read: () => {},
    });
    const hashPromise = readableStreamHasher(mockHashCtor, readableStream);

    const mockError = new Error("error");
    setTimeout(() => {
      mockHashCalculator.emit("error", mockError);
    }, 100);

    try {
      await hashPromise;
      fail(`should throw error ${mockError}`);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it("throws error if hash.digest() throws error", async () => {
    const readableStream = new Readable({
      read: () => {},
    });
    const hashPromise = readableStreamHasher(mockHashCtor, readableStream);

    setTimeout(() => {
      readableStream.emit("end");
    }, 100);

    const mockError = new Error("error");
    mockDigest.mockRejectedValue(mockError);

    try {
      await hashPromise;
      fail(`should throw error ${mockError}`);
    } catch (error) {
      expect(error).toEqual(mockError);
      expect(mockHashCalculatorEnd).toHaveBeenCalledTimes(1);
    }
  });
});
