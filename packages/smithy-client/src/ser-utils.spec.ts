import { describe, expect, test as it } from "vitest";

import { serializeDateTime, serializeFloat } from "./ser-utils";

describe("serializeFloat", () => {
  it("handles non-numerics", () => {
    expect(serializeFloat(NaN)).toEqual("NaN");
    expect(serializeFloat(Infinity)).toEqual("Infinity");
    expect(serializeFloat(-Infinity)).toEqual("-Infinity");
  });

  it("handles normal numbers", () => {
    expect(serializeFloat(1)).toEqual(1);
    expect(serializeFloat(1.1)).toEqual(1.1);
  });
});

describe("serializeDateTime", () => {
  it("should truncate at the top of the second", () => {
    const date = new Date(1716476757761);
    date.setMilliseconds(0);
    expect(serializeDateTime(date)).toEqual("2024-05-23T15:05:57Z");
  });

  it("should not truncate in general", () => {
    const date = new Date(1716476757761);
    expect(serializeDateTime(date)).toEqual("2024-05-23T15:05:57.761Z");
  });
});
