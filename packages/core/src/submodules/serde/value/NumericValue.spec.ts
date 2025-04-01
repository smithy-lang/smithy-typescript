import { describe, expect, test as it } from "vitest";

import { NumericValue, nv } from "./NumericValue";

describe(NumericValue.name, () => {
  it("holds a string representation of a numeric value", () => {
    const num = nv("1.0");
    expect(num).toBeInstanceOf(NumericValue);
    expect(num.string).toEqual("1.0");
    expect(num.type).toEqual("bigDecimal");
  });
});
