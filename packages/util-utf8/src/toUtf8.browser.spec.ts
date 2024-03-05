/**
 * @jest-environment jsdom
 */
import type { Encoder } from "@smithy/types";

import { toUtf8 } from "./toUtf8.browser";

declare const global: any;

describe("toUtf8", () => {
  it("should use the Encoding API", () => {
    const expected = "ABC";
    const decode = jest.fn().mockReturnValue(expected);
    (global as any).TextDecoder = jest.fn(() => ({ decode }));

    expect(toUtf8(new Uint8Array(0))).toBe(expected);
  });

  it("passes through strings", () => {
    expect(toUtf8("hello")).toEqual("hello");
  });

  it("throws on non-string non-Uint8Array", () => {
    expect(() => (toUtf8 as Encoder)(new Date())).toThrow();
    expect(() => (toUtf8 as Encoder)({})).toThrow();
  });
});
