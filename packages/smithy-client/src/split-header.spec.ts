import { splitHeader } from "./split-header";

describe(splitHeader.name, () => {
  it("should split a string by commas and trim only the comma delimited outer values", () => {
    expect(splitHeader("abc")).toEqual(["abc"]);
    expect(splitHeader("a,b,c")).toEqual(["a", "b", "c"]);
    expect(splitHeader("a, b, c")).toEqual(["a", "b", "c"]);
    expect(splitHeader("a , b , c")).toEqual(["a", "b", "c"]);
    expect(splitHeader(`a , b , "  c  "`)).toEqual(["a", "b", "  c  "]);
  });
  it("should split a string by commas that are not in quotes, and remove outer quotes", () => {
    expect(splitHeader('"b,c", "\\"def\\"", a')).toEqual(["b,c", '"def"', "a"]);
    expect(splitHeader('"a,b,c", ""def"", "a,b ,c"')).toEqual(["a,b,c", '"def"', "a,b ,c"]);
  });
});
