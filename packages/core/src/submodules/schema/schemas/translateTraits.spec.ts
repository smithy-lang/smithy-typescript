import { describe, expect, test as it } from "vitest";

import { translateTraits } from "./translateTraits";

describe("translateTraits() caching", () => {
  it("returns the same reference for repeated calls with the same numeric bitmask", () => {
    const first = translateTraits(0b0000_0001);
    const second = translateTraits(0b0000_0001);
    expect(second).toBe(first);

    const a = translateTraits(0b0000_0101);
    const b = translateTraits(0b0000_0101);
    expect(b).toBe(a);
  });

  it("returns object-type indicators as-is (reference equality) without caching", () => {
    const obj = { sensitive: 1 } as const;
    const result = translateTraits(obj);
    expect(result).toBe(obj);
  });

  /**
   * Validates bitmask decoding correctness.
   */
  describe("bitmask decoding produces correct trait keys", () => {
    it("0b0000_0001 → { httpLabel: 1 }", () => {
      expect(translateTraits(0b0000_0001)).toEqual({ httpLabel: 1 });
    });

    it("0b0000_0101 → { httpLabel: 1, idempotencyToken: 1 }", () => {
      expect(translateTraits(0b0000_0101)).toEqual({ httpLabel: 1, idempotencyToken: 1 });
    });

    it("0b0000_0010 → { idempotent: 1 }", () => {
      expect(translateTraits(0b0000_0010)).toEqual({ idempotent: 1 });
    });

    it("0b0000_1000 → { sensitive: 1 }", () => {
      expect(translateTraits(0b0000_1000)).toEqual({ sensitive: 1 });
    });

    it("0b0001_0000 → { httpPayload: 1 }", () => {
      expect(translateTraits(0b0001_0000)).toEqual({ httpPayload: 1 });
    });

    it("0b0100_0000 → { httpQueryParams: 1 }", () => {
      expect(translateTraits(0b0100_0000)).toEqual({ httpQueryParams: 1 });
    });

    it("0b0111_1111 → all traits set", () => {
      expect(translateTraits(0b0111_1111)).toEqual({
        httpLabel: 1,
        idempotent: 1,
        idempotencyToken: 1,
        sensitive: 1,
        httpPayload: 1,
        httpResponseCode: 1,
        httpQueryParams: 1,
      });
    });

    it("0b0000_0000 → empty object", () => {
      expect(translateTraits(0b0000_0000)).toEqual({});
    });
  });
});

describe("performance", () => {
  it("translates traits", () => {
    const start = performance.now();
    for (let i = 0; i < 1_000_000; i++) {
      const n = i % 128;
      translateTraits(n);
    }
    const end = performance.now();

    // 9ms on kuhe's computer.
    expect(end - start).toBeLessThanOrEqual(200);
  });
});
