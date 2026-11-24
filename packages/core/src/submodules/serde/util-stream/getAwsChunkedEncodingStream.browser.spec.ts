import { AwsCrc32, crc32 } from "@aws-crypto/crc32";
import { describe, expect, test as it, vi } from "vitest";

import { getAwsChunkedEncodingStream as getAwsChunkedEncodingStreamRs } from "./getAwsChunkedEncodingStream";
import { getAwsChunkedEncodingStream } from "./getAwsChunkedEncodingStream.browser";

describe(getAwsChunkedEncodingStream.name, () => {
  const mockChecksum = "mockChecksum";
  const mockStreamChunks = ["Hello", "World"];
  const mockBodyLength = 5;

  const mockBase64Encoder = () => mockChecksum;
  const mockBodyLengthChecker = () => mockBodyLength;
  class MockChecksum {
    update() {}
    async digest() {
      return new Uint8Array(4);
    }
    reset() {}
  }
  const mockChecksumLocationName = "mockChecksumLocationName";
  const mockStreamHasher = vi.fn();

  const mockOptions: any = {
    base64Encoder: mockBase64Encoder,
    bodyLengthChecker: mockBodyLengthChecker,
    checksumAlgorithmFn: MockChecksum,
    checksumLocationName: mockChecksumLocationName,
    streamHasher: mockStreamHasher,
  };

  const crc32Options: any = {
    base64Encoder: (bytes: Uint8Array) => Buffer.from(bytes).toString("base64"),
    bodyLengthChecker: () => 0,
    checksumAlgorithmFn: AwsCrc32,
    checksumLocationName: "x-amz-checksum-crc32",
    streamHasher: mockStreamHasher,
  };

  const streamOf = (chunks: unknown[]) =>
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

  const getMockReadableStream = () => streamOf(mockStreamChunks);

  const readAll = async (readableStream: ReadableStream) => {
    const chunks: unknown[] = [];
    const reader = readableStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }
    reader.releaseLock();
    return chunks;
  };

  const readWireBytes = async (readableStream: ReadableStream) => {
    const chunks = await readAll(readableStream);
    for (const chunk of chunks) {
      expect(chunk).toBeInstanceOf(Uint8Array);
    }
    return Buffer.concat(chunks as Uint8Array[]);
  };

  const validateStream = async (readableStream: ReadableStream, expectedBuffer: string) => {
    const wire = await readWireBytes(readableStream);
    expect(wire.toString("utf8")).toEqual(expectedBuffer);
  };

  const crc32Base64 = (data: Uint8Array) => {
    const digest = Buffer.alloc(4);
    digest.writeUInt32BE(crc32(data) >>> 0);
    return digest.toString("base64");
  };

  const decodeAwsChunked = (wire: Buffer) => {
    const payload: Buffer[] = [];
    let offset = 0;
    const readLine = () => {
      const end = wire.indexOf("\r\n", offset);
      if (end < 0) {
        throw new Error(`missing CRLF at offset ${offset}`);
      }
      const line = wire.subarray(offset, end).toString("latin1");
      offset = end + 2;
      return line;
    };
    while (true) {
      const sizeLine = readLine();
      expect(sizeLine).toMatch(/^[0-9a-f]+$/);
      const size = parseInt(sizeLine, 16);
      if (size === 0) {
        break;
      }
      payload.push(wire.subarray(offset, offset + size));
      offset += size;
      expect(wire.subarray(offset, offset + 2).toString("latin1")).toBe("\r\n");
      offset += 2;
    }
    const trailers: string[] = [];
    while (offset < wire.length) {
      const line = readLine();
      if (line === "") {
        break;
      }
      trailers.push(line);
    }
    expect(offset).toBe(wire.length);
    return { payload: Buffer.concat(payload), trailers };
  };

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

  describe("emits only Uint8Array chunks", () => {
    const hello = new TextEncoder().encode("Hello");
    const world = new TextEncoder().encode("World");
    const cases: Array<[string, unknown[]]> = [
      ["string", ["Hello", "World"]],
      ["Uint8Array", [hello, world]],
      ["ArrayBuffer", [hello.slice().buffer, world.slice().buffer]],
      ["DataView over a larger buffer", [new DataView(new TextEncoder().encode("xxHelloyy").buffer, 2, 5), world]],
      ["mixed string and binary", ["Hello", world]],
    ];

    for (const [name, chunks] of cases) {
      it(`for ${name} source chunks`, async () => {
        const awsChunkedBody = getAwsChunkedEncodingStream(streamOf(chunks), crc32Options);
        const emitted = await readAll(awsChunkedBody);
        expect(emitted.length).toBeGreaterThan(0);
        for (const chunk of emitted) {
          expect(chunk).toBeInstanceOf(Uint8Array);
        }
        const wire = Buffer.concat(emitted as Uint8Array[]);
        const expectedChecksum = crc32Base64(new TextEncoder().encode("HelloWorld"));
        expect(wire.toString("latin1")).toBe(
          `5\r\nHello\r\n5\r\nWorld\r\n0\r\nx-amz-checksum-crc32:${expectedChecksum}\r\n\r\n`
        );
        const { payload, trailers } = decodeAwsChunked(wire);
        expect(payload.toString("utf8")).toBe("HelloWorld");
        expect(trailers).toEqual([`x-amz-checksum-crc32:${expectedChecksum}`]);
      });
    }
  });

  it("passes binary data through unchanged", async () => {
    const binary = new Uint8Array(70_000);
    for (let i = 0; i < binary.length; i++) {
      binary[i] = (i * 7 + 0x80) & 0xff;
    }
    const halves = [binary.subarray(0, 40_000), binary.subarray(40_000)];
    const awsChunkedBody = getAwsChunkedEncodingStream(streamOf(halves), crc32Options);
    const emitted = await readAll(awsChunkedBody);
    expect(emitted).toContain(halves[0]);
    expect(emitted).toContain(halves[1]);

    const wire = Buffer.concat(emitted as Uint8Array[]);
    expect(wire.subarray(0, 6).toString("latin1")).toBe(`${(40_000).toString(16)}\r\n`);
    const { payload, trailers } = decodeAwsChunked(wire);
    expect(Buffer.compare(payload, Buffer.from(binary))).toBe(0);
    expect(trailers).toEqual([`x-amz-checksum-crc32:${crc32Base64(binary)}`]);
  });

  it("frames strings by their UTF-8 byte length", async () => {
    const text = "héllo wörld €";
    const encoded = new TextEncoder().encode(text);
    const awsChunkedBody = getAwsChunkedEncodingStream(streamOf([text]), crc32Options);
    const wire = await readWireBytes(awsChunkedBody);
    expect(wire.subarray(0, wire.indexOf("\r\n")).toString("latin1")).toBe(encoded.byteLength.toString(16));
    const { payload, trailers } = decodeAwsChunked(wire);
    expect(payload.toString("utf8")).toBe(text);
    expect(trailers).toEqual([`x-amz-checksum-crc32:${crc32Base64(encoded)}`]);
  });

  it("checksums the streamed bytes", async () => {
    const streamHasher = vi.fn();
    const awsChunkedBody = getAwsChunkedEncodingStream(streamOf(["Hello", "World"]), {
      ...crc32Options,
      streamHasher,
    });
    const { trailers } = decodeAwsChunked(await readWireBytes(awsChunkedBody));
    expect(trailers).toEqual([`x-amz-checksum-crc32:${crc32Base64(new TextEncoder().encode("HelloWorld"))}`]);
    expect(trailers).not.toEqual([`x-amz-checksum-crc32:${crc32Base64(new Uint8Array(0))}`]);
    expect(streamHasher).not.toHaveBeenCalled();
  });

  it("skips empty source chunks", async () => {
    const awsChunkedBody = getAwsChunkedEncodingStream(
      streamOf(["", "Hello", new Uint8Array(0), new ArrayBuffer(0), "World", ""]),
      crc32Options
    );
    const wire = await readWireBytes(awsChunkedBody);
    const { payload } = decodeAwsChunked(wire);
    expect(payload.toString("utf8")).toBe("HelloWorld");
    expect(wire.toString("latin1").startsWith("5\r\nHello\r\n5\r\nWorld\r\n0\r\n")).toBe(true);
  });

  it("encodes an empty source stream", async () => {
    const awsChunkedBody = getAwsChunkedEncodingStream(streamOf([]), crc32Options);
    const wire = await readWireBytes(awsChunkedBody);
    expect(wire.toString("latin1")).toBe(`0\r\nx-amz-checksum-crc32:${crc32Base64(new Uint8Array(0))}\r\n\r\n`);
  });

  it("errors the stream on an unsupported chunk type", async () => {
    const awsChunkedBody = getAwsChunkedEncodingStream(streamOf([42]), crc32Options);
    await expect(readAll(awsChunkedBody)).rejects.toThrow(/unsupported stream chunk type \[object Number\]/);
  });

  it("propagates source stream errors", async () => {
    const failure = new Error("source failed");
    const source = new ReadableStream({
      pull(controller) {
        controller.error(failure);
      },
    });
    await expect(readAll(getAwsChunkedEncodingStream(source, crc32Options))).rejects.toBe(failure);
  });

  it("propagates cancellation to the source stream", async () => {
    const cancel = vi.fn();
    const source = new ReadableStream({
      pull(controller) {
        controller.enqueue("Hello");
      },
      cancel,
    });
    const awsChunkedBody = getAwsChunkedEncodingStream(source, crc32Options);
    const reader = awsChunkedBody.getReader();
    await reader.read();
    await reader.cancel("stop");
    expect(cancel).toHaveBeenCalledWith("stop");
  });
});
