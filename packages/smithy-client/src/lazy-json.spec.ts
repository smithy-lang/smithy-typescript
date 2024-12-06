import { describe, expect, test as it } from "vitest";

import { LazyJsonString } from "./lazy-json";
describe("LazyJsonString", () => {
  it("returns identical values for toString(), valueOf(), and toJSON()", () => {
    const jsonValue = LazyJsonString.from({ foo: "bar" });
    expect(jsonValue.valueOf()).toBe(JSON.stringify({ foo: "bar" }));
    expect(jsonValue.toString()).toBe(JSON.stringify({ foo: "bar" }));
    expect(jsonValue.toJSON()).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("can instantiate from LazyJsonString class", () => {
    const original = LazyJsonString.from('"foo"');
    const newOne = LazyJsonString.from(original);
    expect(newOne.toString()).toBe('"foo"');
  });

  it("can instantiate from String class", () => {
    const jsonValue = LazyJsonString.from('"foo"');
    expect(jsonValue.toString()).toBe('"foo"');
  });

  it("can instantiate from object", () => {
    const jsonValue = LazyJsonString.from({ foo: "bar" });
    expect(jsonValue.toString()).toBe('{"foo":"bar"}');
  });
});
