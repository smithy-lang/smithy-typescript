import { describe, expect, test as it } from "vitest";

import { isSerializableHeaderValue } from "./is-serializable-header-value";

describe(isSerializableHeaderValue.name, () => {
  it("considers empty strings serializable", () => {
    expect(isSerializableHeaderValue("")).toBe(true);
  });

  it("considers empty collections serializable", () => {
    expect(isSerializableHeaderValue(new Set())).toBe(true);
    expect(isSerializableHeaderValue([])).toBe(true);
  });

  it("considers most falsy data values to be serializable", () => {
    expect(isSerializableHeaderValue(false)).toBe(true);
    expect(isSerializableHeaderValue(0)).toBe(true);
    expect(isSerializableHeaderValue(new Date(0))).toBe(true);
  });

  it("considered undefined and null to be unserializable", () => {
    expect(isSerializableHeaderValue(undefined)).toBe(false);
    expect(isSerializableHeaderValue(null)).toBe(false);
  });
});
