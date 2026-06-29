import { describe, expect, it } from "vitest";

import { crc32IncrementalChunks, crc32Vectors, utf8 } from "../checksum.fixture";
import { Crc32Js } from "./Crc32Js";
import { Crc32Node } from "./Crc32Node";

const digestUint32 = async (hash: InstanceType<typeof Crc32Node>) =>
  new DataView((await hash.digest()).buffer).getUint32(0, false);

describe("Crc32Node", () => {
  for (const [input, expected] of crc32Vectors) {
    it(`should hash ${input.length} bytes to 0x${expected.toString(16)}`, async () => {
      const hash = new Crc32Node();
      hash.update(input);
      expect(await digestUint32(hash)).toBe(expected);
    });
  }

  it("should support incremental updates", async () => {
    const hash = new Crc32Node();
    for (const [chunk, expected] of crc32IncrementalChunks) {
      hash.update(chunk);
      expect(await digestUint32(hash)).toBe(expected);
    }
  });

  it("should reset to initial state", async () => {
    const hash = new Crc32Node();
    hash.update(utf8("garbage"));
    hash.reset();
    hash.update(utf8("The quick brown fox jumps over the lazy dog"));
    expect(await digestUint32(hash)).toBe(0x414fa339);
  });

  it("should produce identical results to Crc32Js (pure JS)", async () => {
    const data = utf8("cross-implementation consistency check");
    const js = new Crc32Js();
    js.update(data);
    const node = new Crc32Node();
    node.update(data);
    expect(await node.digest()).toEqual(await js.digest());
  });

  describe("digestSync", () => {
    for (const [input, expected] of crc32Vectors) {
      it(`should return 0x${expected.toString(16)} for ${input.length} bytes`, () => {
        const hash = new Crc32Node();
        hash.update(input);
        expect(hash.digestSync()).toBe(expected);
      });
    }

    it("should support incremental updates", () => {
      const hash = new Crc32Node();
      for (const [chunk, expected] of crc32IncrementalChunks) {
        hash.update(chunk);
        expect(hash.digestSync()).toBe(expected);
      }
    });

    it("should match Crc32Js.digestSync()", () => {
      const data = utf8("cross-implementation consistency check");
      const js = new Crc32Js();
      js.update(data);
      const node = new Crc32Node();
      node.update(data);
      expect(node.digestSync()).toBe(js.digestSync());
    });
  });
});
