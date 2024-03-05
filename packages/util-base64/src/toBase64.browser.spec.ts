/**
 * @jest-environment jsdom
 */
import type { Encoder } from "@smithy/types";

import testCases from "./__mocks__/testCases.json";
import { toBase64 } from "./toBase64.browser";

describe(toBase64.name, () => {
  it.each(testCases as Array<[string, string, number[]]>)("%s", (desc, encoded, decoded) => {
    expect(toBase64(new Uint8Array(decoded))).toEqual(encoded);
  });

  it("also converts strings", () => {
    expect(toBase64("hello")).toEqual("aGVsbG8=");
  });

  it("throws on non-string non-Uint8Array", () => {
    expect(() => (toBase64 as Encoder)(new Date())).toThrow();
    expect(() => (toBase64 as Encoder)({})).toThrow();
  });
});
