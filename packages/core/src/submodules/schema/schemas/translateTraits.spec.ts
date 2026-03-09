import { describe, expect, test as it } from "vitest";

import { translateTraits } from "./translateTraits";

describe("translateTraits() caching", () => {
  /**
   * Validates: Requirements 2.1, 2.2 (Property 3)
   */
  it("returns the same reference for repeated calls with the same numeric bitmask", () => {
    const first = translateTraits(0b0000_0001);
    const second = translateTraits(0b0000_0001);
    expect(second).toBe(first);

    const a = translateTraits(0b0000_0101);
    const b = translateTraits(0b0000_0101);
    expect(b).toBe(a);
  });

  /**
   * Validates: Requirement 2.3 (Property 4)
   */
  it("returns object-type indicators as-is (reference equality) without caching", () => {
    const obj = { sensitive: 1 } as const;
    const result = translateTraits(obj);
    expect(result).toBe(obj);
  });

  /**
   * Validates: Requirements 3.1, 3.2 (Property 5)
   */
  it("cached trait objects are frozen", () => {
    const traits = translateTraits(0b0000_1000);
    expect(Object.isFrozen(traits)).toBe(true);

    // Also verify a different bitmask
    const traits2 = translateTraits(0b0011_0000);
    expect(Object.isFrozen(traits2)).toBe(true);
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
