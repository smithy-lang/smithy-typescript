import type { Encoder } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import testCases from "./__mocks__/testCases.json";
import { toBase64 } from "./toBase64";

describe(toBase64.name, () => {
  it.each(testCases as Array<[string, string, number[]]>)("%s", (desc, encoded, decoded) => {
    expect(toBase64(new Uint8Array(decoded))).toEqual(encoded);
  });

  it("should throw when given a number", () => {
    expect(() => toBase64(0xdeadbeefface as any)).toThrow();
  });

  it("also converts strings", () => {
    expect(toBase64("hello")).toEqual("aGVsbG8=");
  });

  it("throws on non-string non-Uint8Array", () => {
    expect(() => (toBase64 as Encoder)(new Date())).toThrow();
    expect(() => (toBase64 as Encoder)({})).toThrow();
  });
});
