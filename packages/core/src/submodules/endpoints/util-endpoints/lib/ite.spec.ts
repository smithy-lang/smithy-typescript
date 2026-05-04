import { describe, expect, test as it } from "vitest";

import { ite } from "./ite";

describe(ite.name, () => {
  it.each([
    [true, "-fips", "", "-fips"],
    [false, "-fips", "", ""],
    [true, "sigv4", "sigv4-s3express", "sigv4"],
    [false, "sigv4", "sigv4-s3express", "sigv4-s3express"],
  ])("ite(%s, %j, %j) returns %j", (condition, trueValue, falseValue, expected) => {
    expect(ite(condition, trueValue, falseValue)).toBe(expected);
  });

  it("returns undefined trueValue when condition is true", () => {
    expect(ite(true, undefined, "fallback")).toBeUndefined();
  });

  it("returns undefined falseValue when condition is false", () => {
    expect(ite(false, "value", undefined)).toBeUndefined();
  });
});
