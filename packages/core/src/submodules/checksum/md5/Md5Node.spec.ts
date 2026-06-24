import { fromBase64, toHex } from "@smithy/core/serde";
import { describe, expect, it } from "vitest";

import { Md5Js } from "./Md5Js";
import { Md5Node } from "./Md5Node";

const hashVectors = require("hash-test-vectors");

describe("Md5Node", () => {
  describe("hash vectors", () => {
    let idx = 0;
    for (const { input, ...results } of hashVectors) {
      const expected = results["md5"];
      it(`should calculate a MD5 hash of ${expected} for test vector ${++idx}`, async () => {
        const hash = new Md5Node();
        hash.update(fromBase64(input));
        expect(toHex(await hash.digest())).toBe(expected);
      });
    }
  });

  it("should reset state", async () => {
    const hash = new Md5Node();
    hash.update(new Uint8Array([97, 98, 99]));
    hash.reset();
    hash.update(new Uint8Array([97, 98, 99]));
    // MD5("abc") = 900150983cd24fb0d6963f7d28e17f72
    expect(toHex(await hash.digest())).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("should allow multiple digest() calls without consuming state", async () => {
    const hash = new Md5Node();
    hash.update(new Uint8Array([97, 98, 99]));
    const first = await hash.digest();
    const second = await hash.digest();
    expect(first).toEqual(second);
  });

  it("should produce identical results to Md5Js (pure JS)", async () => {
    const data = new Uint8Array([10, 20, 30, 40, 50]);
    const js = new Md5Js();
    js.update(data);
    const node = new Md5Node();
    node.update(data);
    expect(await node.digest()).toEqual(await js.digest());
  });

  it("should accept a string input", async () => {
    const hash = new Md5Node();
    hash.update("abc");
    // MD5("abc") = 900150983cd24fb0d6963f7d28e17f72
    expect(toHex(await hash.digest())).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("should accept an ArrayBuffer input", async () => {
    const hash = new Md5Node();
    hash.update(new Uint8Array([97, 98, 99]).buffer);
    expect(toHex(await hash.digest())).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});
