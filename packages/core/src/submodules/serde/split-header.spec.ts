import { describe, expect, test as it } from "vitest";

import { quoteHeader } from "./quote-header";
import { splitHeader } from "./split-header";

describe(splitHeader.name, () => {
  it("should split a string by commas and trim only the comma delimited outer values", () => {
    expect(splitHeader("abc")).toEqual(["abc"]);
    expect(splitHeader("a,b,c")).toEqual(["a", "b", "c"]);
    expect(splitHeader("a, b, c")).toEqual(["a", "b", "c"]);
    expect(splitHeader("a , b , c")).toEqual(["a", "b", "c"]);
    expect(splitHeader(`a , b , "  c  "`)).toEqual(["a", "b", "  c  "]);
    expect(splitHeader(`  a  ,     , b`)).toEqual(["a", "", "b"]);
    expect(splitHeader(`,,`)).toEqual(["", "", ""]);
    expect(splitHeader(`    ,    ,    `)).toEqual(["", "", ""]);
  });
  it("should split a string by commas that are not in quotes, and remove outer quotes", () => {
    expect(splitHeader('"b,c", "\\"def\\"", a')).toEqual(["b,c", '"def"', "a"]);
    expect(splitHeader('"a,b,c", ""def"", "a,b ,c"')).toEqual(["a,b,c", '"def"', "a,b ,c"]);
    expect(splitHeader(`""`)).toEqual([``]);
    expect(splitHeader(``)).toEqual([``]);
    expect(splitHeader(`\\"`)).toEqual([`"`]);
    expect(splitHeader(`"`)).toEqual([`"`]);
  });
  it("should treat an escaped backslash before a quote as a literal backslash", () => {
    expect(splitHeader(`"a,\\\\", b`)).toEqual([`a,\\`, "b"]);
    expect(splitHeader(`"\\\\\\"", b`)).toEqual([`\\"`, "b"]);
    expect(splitHeader(`"a\\\\\\\\", b`)).toEqual([`a\\\\`, "b"]);
  });
  it("should unescape backslashes only within quoted values", () => {
    expect(splitHeader(`"a\\\\b"`)).toEqual([`a\\b`]);
    expect(splitHeader(`a\\\\b`)).toEqual([`a\\\\b`]);
    expect(splitHeader(`a\\"b`)).toEqual([`a"b`]);
  });
  it("should round-trip values produced by quoteHeader", () => {
    const values = [`a`, `a,b`, `"`, `\\`, `a,\\`, `\\"`, `\\\\`, `"\\",`, `a\\"b,c`, `\\\\\\"`];
    expect(splitHeader(values.map(quoteHeader).join(", "))).toEqual(values);
  });
});
