import { describe, expect, test as it } from "vitest";

import { Int64 } from "./Int64";

describe("Int64", () => {
  it("should hold integers greater than Number.MAX_SAFE_INTEGER without losing precision", () => {
    const bytes = Uint8Array.from([0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

    expect(new Int64(bytes).bytes).toEqual(bytes);
  });

  it("should allow the use of Int64s in arithmetic expressions", () => {
    const bytes = Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10]);

    expect((new Int64(bytes) as any) + 4).toBe(20);
  });

  it("should allow the use of negative Int64s in arithmetic expressions", () => {
    const bytes = Uint8Array.from([0xff, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

    expect((new Int64(bytes) as any) + 2 ** 52).toBe(0);
  });

  it("should stringify negative Int64s in base 10", () => {
    const bytes = Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xe2]);

    expect(String(new Int64(bytes))).toBe("-30");
  });

  it("should throw when given a buffer of the wrong byte length", () => {
    expect(() => new Int64(new Uint8Array(0))).toThrow();
  });

  it("should convert numbers into Int64 values", () => {
    expect(Int64.fromNumber(2147483647).bytes).toEqual(
      Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0x7f, 0xff, 0xff, 0xff])
    );
  });

  it("should convert negative numbers into Int64 values", () => {
    expect(Int64.fromNumber(-2147483647).bytes).toEqual(
      Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0x80, 0x00, 0x00, 0x01])
    );
  });

  it.each([NaN, Infinity, -Infinity, 2 ** 63, 2 ** 63 + 2048, -(2 ** 63) - 2048])(
    "should reject an unrepresentable number: %s",
    (number) => {
      expect(() => Int64.fromNumber(number)).toThrow();
    }
  );

  it.each([
    [2 ** 63 - 1024, [0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfc, 0x00]],
    [-(2 ** 63), [0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]],
    [-(2 ** 63) + 1024, [0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00]],
  ])("should preserve a representable boundary: %s", (number, bytes) => {
    const value = Int64.fromNumber(number);
    expect(value.bytes).toEqual(Uint8Array.from(bytes));
    expect(value.valueOf()).toBe(number);
  });

  it.each([0, -0, 1.4, 1.5, -1.4, -1.5])("should preserve rounding for %s", (number) => {
    expect(Int64.fromNumber(number).valueOf()).toBe(Math.round(number) || 0);
  });

  it("should throw when a number larger than 2^63 -1 is provided", () => {
    // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
    expect(() => Int64.fromNumber(9_323_372_036_854_775_807)).toThrow();
  });

  it("should throw when a number smaller than -1 * 2^63 is provided", () => {
    // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
    expect(() => Int64.fromNumber(-9_323_372_036_854_775_807)).toThrow();
  });
});
