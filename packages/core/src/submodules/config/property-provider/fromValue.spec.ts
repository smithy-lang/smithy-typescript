import { describe, expect, test as it } from "vitest";

import { fromValue } from "./fromValue";

describe("fromStatic", () => {
  it("should convert a static value into a provider", async () => {
    const staticValue = "staticValue";
    const provider = fromValue(staticValue);
    return expect(provider()).resolves.toStrictEqual(staticValue);
  });

  it("should always return the same promise", () => {
    const provider = fromValue("string");
    const result = provider();

    Array.from({ length: 5 }).forEach(() => {
      expect(provider()).toStrictEqual(result);
    });
  });
});
