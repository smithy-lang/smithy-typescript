import { describe, expect, it } from "vitest";

import { sha256HashVectors, sha256HmacVectors, toHex } from "../checksum.fixture";
import { Sha256Js } from "./Sha256Js";
import { Sha256Node } from "./Sha256Node";

describe("Sha256Node", () => {
  describe("hash vectors", () => {
    for (const [input, expected] of sha256HashVectors) {
      it(`should hash ${input.length} bytes to ${expected.slice(0, 16)}...`, async () => {
        const hash = new Sha256Node();
        hash.update(input);
        expect(toHex(await hash.digest())).toBe(expected);
      });
    }
  });

  describe("HMAC vectors (RFC 4231)", () => {
    for (const [key, data, expected] of sha256HmacVectors) {
      it(`should HMAC with ${key.length}-byte key to ${expected.slice(0, 16)}...`, async () => {
        const hash = new Sha256Node(key);
        hash.update(data);
        expect(toHex(await hash.digest())).toBe(expected);
      });
    }
  });

  it("should reset state", async () => {
    const hash = new Sha256Node();
    hash.update(Uint8Array.from([1, 2, 3]));
    hash.reset();
    hash.update(Uint8Array.from([97, 98, 99]));
    expect(toHex(await hash.digest())).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("should produce identical results to Sha256Js (pure JS)", async () => {
    const data = Uint8Array.from([10, 20, 30, 40, 50]);
    const js = new Sha256Js();
    js.update(data);
    const node = new Sha256Node();
    node.update(data);
    expect(await node.digest()).toEqual(await js.digest());
  });
});
