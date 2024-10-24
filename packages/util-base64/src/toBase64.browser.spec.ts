/**
 * @jest-environment jsdom
 */
import type { Encoder } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import testCases from "./__mocks__/testCases.json";
import { fromBase64 } from "./fromBase64.browser";
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

  it("allows array to stand in for Uint8Array", () => {
    expect(() => (toBase64 as Encoder)([])).not.toThrow();

    const helloUtf8Array = fromBase64("aGVsbG8=");
    expect(toBase64([...helloUtf8Array] as unknown as Uint8Array)).toEqual("aGVsbG8=");
  });
});
