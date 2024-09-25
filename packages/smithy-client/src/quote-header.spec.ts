import { quoteHeader } from "./quote-header";

describe(quoteHeader.name, () => {
  it("should not wrap header elements that don't include the delimiter or double quotes", () => {
    expect(quoteHeader("bc")).toBe("bc");
  });

  it("should wrap header elements that include the delimiter", () => {
    expect(quoteHeader("b,c")).toBe('"b,c"');
  });

  it("should wrap header elements that include double quotes", () => {
    expect(quoteHeader(`"bc"`)).toBe('"\\"bc\\""');
  });

  it("should wrap header elements that include the delimiter and double quotes", () => {
    expect(quoteHeader(`"b,c"`)).toBe('"\\"b,c\\""');
  });
});
