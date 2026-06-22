import crypto from "node:crypto";
import { fromBase64 } from "@smithy/core/serde";
import { describe, expect, it } from "vitest";

import { sha256HashVectors, sha256HmacVectors, toHex } from "../checksum.fixture";
import { Sha256Js } from "./Sha256Js";

const hashTestVectors = require("hash-test-vectors");

describe("Sha256Js", () => {
  describe("hash vectors", () => {
    for (const [input, expected] of sha256HashVectors) {
      it(`should hash ${input.length} bytes to ${expected.slice(0, 16)}...`, async () => {
        const hash = new Sha256Js();
        hash.update(input);
        expect(toHex(await hash.digest())).toBe(expected);
      });
    }
  });

  describe("NIST vectors (hash-test-vectors)", () => {
    let idx = 0;
    for (const { input, sha256: expected } of hashTestVectors) {
      it(`NIST vector ${++idx}`, async () => {
        const hash = new Sha256Js();
        hash.update(fromBase64(input));
        expect(toHex(await hash.digest())).toBe(expected);
      });
    }
  });

  describe("HMAC vectors (RFC 4231)", () => {
    for (const [key, data, expected] of sha256HmacVectors) {
      it(`should HMAC with ${key.length}-byte key to ${expected.slice(0, 16)}...`, async () => {
        const hash = new Sha256Js(key);
        hash.update(data);
        expect(toHex(await hash.digest())).toBe(expected);
      });
    }
  });

  it("should allow update after digest (non-destructive)", async () => {
    const hash = new Sha256Js();
    hash.update(new Uint8Array([97, 98, 99]));
    const first = toHex(await hash.digest());
    hash.update(new Uint8Array([100]));
    const second = toHex(await hash.digest());
    // "abc" vs "abcd"
    expect(first).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(second).toBe("88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589");
  });

  it("should support incremental updates", async () => {
    const hash = new Sha256Js();
    hash.update(Uint8Array.from([97]));
    hash.update(Uint8Array.from([98]));
    hash.update(Uint8Array.from([99]));
    expect(toHex(await hash.digest())).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  // Exceeds 512 MB (2^32 bits) to exercise the high 32-bit word of the 64-bit message length padding.
  it("should produce correct hash when message length exceeds 2^32 bits (520 MB)", async () => {
    const chunk = new Uint8Array(64 * 1024 * 1024).fill(0x61);
    const hash = new Sha256Js();
    const nodeHash = crypto.createHash("sha256");

    // Feed 520 MB in 65 × 8 MB chunks
    for (let i = 0; i < 65; ++i) {
      const slice = chunk.subarray(0, 8 * 1024 * 1024);
      hash.update(slice);
      nodeHash.update(slice);
    }

    expect(toHex(await hash.digest())).toBe(nodeHash.digest("hex"));
  }, 60_000);
});
