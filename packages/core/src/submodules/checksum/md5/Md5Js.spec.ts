import { fromBase64, toHex } from "@smithy/core/serde";
import { describe, expect, test as it } from "vitest";

import { Md5Js } from "./Md5Js";

const hashVectors = require("hash-test-vectors");

describe("Md5Js", () => {
  let idx = 0;
  for (const { input, ...results } of hashVectors) {
    const expected = results["md5"];
    it(`should calculate a MD5 hash of ${expected} for test vector ${++idx}`, async () => {
      const hash = new Md5Js();
      hash.update(fromBase64(input));
      expect(toHex(await hash.digest())).toBe(expected);
    });
  }

  it("should accept a string input", async () => {
    const hash = new Md5Js();
    hash.update("abc");
    expect(toHex(await hash.digest())).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("should accept an ArrayBuffer input", async () => {
    const hash = new Md5Js();
    hash.update(new Uint8Array([97, 98, 99]).buffer);
    expect(toHex(await hash.digest())).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});
