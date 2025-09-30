import { describe, expect, test as it } from "vitest";

import { NumericValue, nv } from "./NumericValue";

describe(NumericValue.name, () => {
  it("holds a string representation of a numeric value", () => {
    const num = nv("1.0");
    expect(num).toBeInstanceOf(NumericValue);
    expect(num.string).toEqual("1.0");
    expect(num.type).toEqual("bigDecimal");
  });

  it("allows only numeric digits and at most one decimal point", () => {
    expect(() => nv("a")).toThrow();
    expect(() => nv("1.0.1")).toThrow();
    expect(() => nv("-10.1")).not.toThrow();
    expect(() => nv("-.101")).not.toThrow();
  });

  it("has a custom instanceof check", () => {
    const isInstance = [
      nv("0"),
      nv("-0.00"),
      new NumericValue("0", "bigDecimal"),
      new NumericValue("-0.00", "bigDecimal"),
      {
        string: "-.123",
        type: "bigDecimal",
      },
      (() => {
        const x = {};
        Object.setPrototypeOf(x, NumericValue.prototype);
        return x;
      })(),
      (() => {
        function F() {}
        F.prototype = Object.create(NumericValue.prototype);
        // @ts-ignore
        return new F();
      })(),
      (() => {
        return new (class extends NumericValue {})("0", "bigDecimal");
      })(),
    ] as unknown[];

    const isNotInstance = [
      BigInt(0),
      "-0.00",
      {
        string: "abcd",
        type: "bigDecimal",
      },
      (() => {
        const x = {};
        Object.setPrototypeOf(x, NumericValue);
        return x;
      })(),
    ] as unknown[];

    for (const instance of isInstance) {
      expect(instance).toBeInstanceOf(NumericValue);
    }

    for (const instance of isNotInstance) {
      expect(instance).not.toBeInstanceOf(NumericValue);
    }
  });
});
