import { describe, expect, it } from "vitest";

import { crc32IncrementalChunks, crc32Vectors, utf8 } from "../checksum.fixture";
import { Crc32Js } from "./Crc32Js";

const digestUint32 = async (hash: Crc32Js) => new DataView((await hash.digest()).buffer).getUint32(0, false);

describe("Crc32Js", () => {
  for (const [input, expected] of crc32Vectors) {
    it(`should hash ${input.length} bytes to 0x${expected.toString(16)}`, async () => {
      const hash = new Crc32Js();
      hash.update(input);
      expect(await digestUint32(hash)).toBe(expected);
    });
  }

  it("should support incremental updates", async () => {
    const hash = new Crc32Js();
    for (const [chunk, expected] of crc32IncrementalChunks) {
      hash.update(chunk);
      expect(await digestUint32(hash)).toBe(expected);
    }
  });

  it("should reset to initial state", async () => {
    const hash = new Crc32Js();
    hash.update(utf8("garbage"));
    hash.reset();
    hash.update(utf8("The quick brown fox jumps over the lazy dog"));
    expect(await digestUint32(hash)).toBe(0x414fa339);
  });

  describe("digestSync", () => {
    for (const [input, expected] of crc32Vectors) {
      it(`should return 0x${expected.toString(16)} for ${input.length} bytes`, () => {
        const hash = new Crc32Js();
        hash.update(input);
        expect(hash.digestSync()).toBe(expected);
      });
    }

    it("should support incremental updates", () => {
      const hash = new Crc32Js();
      for (const [chunk, expected] of crc32IncrementalChunks) {
        hash.update(chunk);
        expect(hash.digestSync()).toBe(expected);
      }
    });
  });
});
