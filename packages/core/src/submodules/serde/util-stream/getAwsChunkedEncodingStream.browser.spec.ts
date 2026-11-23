import { describe, expect, test as it, vi } from "vitest";

import { getAwsChunkedEncodingStream as getAwsChunkedEncodingStreamRs } from "./getAwsChunkedEncodingStream";
import { getAwsChunkedEncodingStream } from "./getAwsChunkedEncodingStream.browser";

describe(getAwsChunkedEncodingStream.name, () => {
  const mockChecksum = "mockChecksum";
  const mockRawChecksum = Buffer.from(mockChecksum);
  const mockStreamChunks = ["Hello", "World"];
  const mockBodyLength = 5;

  const mockBase64Encoder = () => mockChecksum;
  const mockBodyLengthChecker = () => mockBodyLength;
  const mockChecksumAlgorithmFn = () => {};
  const mockChecksumLocationName = "mockChecksumLocationName";
  const mockStreamHasher = () => mockRawChecksum;

  const mockOptions: any = {
    base64Encoder: mockBase64Encoder,
    bodyLengthChecker: mockBodyLengthChecker,
    checksumAlgorithmFn: mockChecksumAlgorithmFn,
    checksumLocationName: mockChecksumLocationName,
    streamHasher: mockStreamHasher,
  };

  const getMockReadableStream = () => {
    return new ReadableStream({
      start(controller) {
        for (const chunk of mockStreamChunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
  };

  const validateStream = async (readableStream: ReadableStream, expectedBuffer: string) => {
    let buffer = "";
    const reader = readableStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += value;
    }
    reader.releaseLock();
    expect(buffer).toEqual(expectedBuffer);
  };

  it("forwards cancellation to the source and releases its reader", async () => {
    const cancel = vi.fn();
    const source = new ReadableStream({ cancel });
    const encoded = getAwsChunkedEncodingStream(source, { bodyLengthChecker: mockBodyLengthChecker });
    const reason = new Error("Upload stopped");

    await encoded.cancel(reason);

    expect(cancel).toHaveBeenCalledExactlyOnceWith(reason);
    expect(source.locked).toBe(false);
  });

  it("cancels a source with a pending read", async () => {
    let started!: () => void;
    const reading = new Promise<void>((resolve) => {
      started = resolve;
    });
    const cancel = vi.fn();
    const source = new ReadableStream({ pull: started, cancel }, { highWaterMark: 0 });
    const reader = getAwsChunkedEncodingStream(source, { bodyLengthChecker: mockBodyLengthChecker }).getReader();
    const pending = reader.read();
    const reason = { stopped: true };

    await reading;
    await reader.cancel(reason);

    expect(await pending).toEqual({ done: true, value: undefined });
    expect(cancel).toHaveBeenCalledExactlyOnceWith(reason);
    expect(source.locked).toBe(false);
    reader.releaseLock();
  });

  it.each([false, true])("releases the source reader on completion (checksum: %s)", async (checksum) => {
    const source = getMockReadableStream();
    const encoded = getAwsChunkedEncodingStream(
      source,
      checksum ? mockOptions : { bodyLengthChecker: mockBodyLengthChecker }
    );
    const reader = encoded.getReader();
    while (!(await reader.read()).done) {
      // Drain the encoded body.
    }
    reader.releaseLock();

    expect(source.locked).toBe(false);
  });

  it("releases the source reader when the source errors", async () => {
    const error = new Error("Source failed");
    const source = new ReadableStream({ start: (controller) => controller.error(error) });
    const reader = getAwsChunkedEncodingStream(source, { bodyLengthChecker: mockBodyLengthChecker }).getReader();

    await expect(reader.read()).rejects.toBe(error);

    expect(source.locked).toBe(false);
    reader.releaseLock();
  });

  it.each([false, true])(
    "cancels on encoding errors without replacing the error (cleanup rejects: %s)",
    async (reject) => {
      const error = new Error("Encoding failed");
      const cancel = vi.fn(async () => {
        if (reject) {
          throw new Error("Cleanup failed");
        }
      });
      const source = new ReadableStream({ start: (controller) => controller.enqueue("Hello"), cancel });
      const reader = getAwsChunkedEncodingStream(source, {
        bodyLengthChecker: () => {
          throw error;
        },
      }).getReader();

      await expect(reader.read()).rejects.toBe(error);

      expect(cancel).toHaveBeenCalledExactlyOnceWith(error);
      expect(source.locked).toBe(false);
      reader.releaseLock();
    }
  );

  it("releases the source reader when checksum computation fails", async () => {
    const error = new Error("Checksum failed");
    const source = getMockReadableStream();
    const reader = getAwsChunkedEncodingStream(source, {
      ...mockOptions,
      streamHasher: () => Promise.reject(error),
    }).getReader();

    await expect(
      (async () => {
        while (!(await reader.read()).done) {
          // Drain until the checksum failure.
        }
      })()
    ).rejects.toBe(error);

    expect(source.locked).toBe(false);
    reader.releaseLock();
  });

  it("can be cancelled while waiting for the checksum", async () => {
    let resolveDigest!: (value: Uint8Array) => void;
    const digest = new Promise<Uint8Array>((resolve) => {
      resolveDigest = resolve;
    });
    const base64Encoder = vi.fn(mockBase64Encoder);
    const source = new ReadableStream({ start: (controller) => controller.close() });
    const reader = getAwsChunkedEncodingStream(source, {
      ...mockOptions,
      base64Encoder,
      streamHasher: () => digest,
    }).getReader();

    expect(await reader.read()).toEqual({ done: false, value: "0\r\n" });
    await reader.cancel("Stopped before checksum");
    resolveDigest(mockRawChecksum);
    await digest;

    expect(base64Encoder).not.toHaveBeenCalled();
    expect(source.locked).toBe(false);
    reader.releaseLock();
  });

  it("releases the reader even when source cancellation rejects", async () => {
    const error = new Error("Cancellation failed");
    const source = new ReadableStream({ cancel: () => Promise.reject(error) });
    const encoded = getAwsChunkedEncodingStream(source, { bodyLengthChecker: mockBodyLengthChecker });

    await expect(encoded.cancel("Stopped")).rejects.toBe(error);

    expect(source.locked).toBe(false);
  });

  it("waits for asynchronous source cancellation before releasing the reader", async () => {
    let finishCancellation!: () => void;
    const cancellation = new Promise<void>((resolve) => {
      finishCancellation = resolve;
    });
    const source = new ReadableStream({ cancel: () => cancellation });
    const encoded = getAwsChunkedEncodingStream(source, { bodyLengthChecker: mockBodyLengthChecker });
    let settled = false;
    const done = encoded.cancel("Stopped").then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(source.locked).toBe(true);
    finishCancellation();
    await done;

    expect(settled).toBe(true);
    expect(source.locked).toBe(false);
  });

  describe("skips checksum computation", () => {
    const expectedBuffer = `5\r
Hello\r
5\r
World\r
0\r
`;

    it("if none of the required options are passed", async () => {
      const readableStream = getMockReadableStream();
      const awsChunkedBody = getAwsChunkedEncodingStream(readableStream, {
        bodyLengthChecker: mockBodyLengthChecker,
      });
      await validateStream(awsChunkedBody, expectedBuffer);
    });

    ["base64Encoder", "checksumAlgorithmFn", "checksumLocationName", "streamHasher"].forEach((optionToRemove) => {
      it(`if option '${optionToRemove} is not passed`, async () => {
        const readableStream = getMockReadableStream();
        const awsChunkedBody = getAwsChunkedEncodingStream(readableStream, {
          ...mockOptions,
          [optionToRemove]: undefined,
        });
        await validateStream(awsChunkedBody, expectedBuffer);
      });
    });
  });

  it("computes checksum and adds it to the end event", async () => {
    const readableStream = getMockReadableStream();
    const awsChunkedBody = getAwsChunkedEncodingStream(readableStream, mockOptions);
    const expectedBuffer = `5\r
Hello\r
5\r
World\r
0\r
${mockChecksumLocationName}:${mockChecksum}\r
\r
`;
    await validateStream(awsChunkedBody, expectedBuffer);
  });

  it("redirects from Readable to ReadableStream implementation", async () => {
    const readableStream = getMockReadableStream();
    const awsChunkedBody = getAwsChunkedEncodingStreamRs(readableStream, mockOptions);
    const expectedBuffer = `5\r
Hello\r
5\r
World\r
0\r
${mockChecksumLocationName}:${mockChecksum}\r
\r
`;
    await validateStream(awsChunkedBody, expectedBuffer);
  });
});
