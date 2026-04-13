import { describe, expect, test as it } from "vitest";

import { coalesce } from "./coalesce";

describe(coalesce.name, () => {
  it("returns first non-empty value", () => {
    expect(coalesce("a", "b")).toBe("a");
  });

  it("skips undefined and returns first non-empty value", () => {
    expect(coalesce(undefined, "b")).toBe("b");
  });

  it("returns last arg when all preceding are undefined", () => {
    expect(coalesce(undefined, undefined, "c")).toBe("c");
  });

  it("returns undefined when all args are undefined", () => {
    expect(coalesce(undefined, undefined)).toBeUndefined();
  });

  it("returns false as non-empty", () => {
    expect(coalesce(false, true)).toBe(false);
  });

  it("returns 0 as non-empty", () => {
    expect(coalesce(0, 1)).toBe(0);
  });

  it("returns empty string as non-empty", () => {
    expect(coalesce("", "fallback")).toBe("");
  });

  it("works with more than two arguments", () => {
    expect(coalesce(undefined, undefined, undefined, "d")).toBe("d");
  });
});
