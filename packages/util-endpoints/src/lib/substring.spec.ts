import { describe, expect, test as it } from "vitest";

import { substring } from "./substring";

describe(substring.name, () => {
  describe("returns null", () => {
    it("when input is falsy", () => {
      expect(substring("", 0, 1, false)).toBeNull();
      expect(substring("", 0, 0, false)).toBeNull();
      expect(substring(null as any, 0, 1, false)).toBeNull();
      expect(substring(undefined as any, 0, 1, false)).toBeNull();
    });

    it("when start >= stop", () => {
      expect(substring("abc", 0, 0, false)).toBeNull();
      expect(substring("abc", 1, 0, false)).toBeNull();
    });

    it("when input.length < stop", () => {
      expect(substring("ab", 0, 5, false)).toBeNull();
    });

    it("when input contains non-ASCII characters", () => {
      expect(substring("abc\u0080", 0, 3, false)).toBeNull();
      expect(substring("abcé", 0, 3, false)).toBeNull();
      expect(substring("ab日c", 0, 3, false)).toBeNull();
    });
  });

  it("returns substring", () => {
    expect(substring("abcde", 0, 3, false)).toBe("abc");
  });

  it("returns substring with reverse=true", () => {
    expect(substring("abcde", 0, 3, true)).toBe("cde");
  });
});
