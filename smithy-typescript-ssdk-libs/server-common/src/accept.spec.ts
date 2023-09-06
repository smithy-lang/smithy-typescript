import { acceptMatches } from "./accept";

describe("acceptMatches", () => {
  it.each([null, undefined, "*/*"])("always returns true for %s", (value) => {
    expect(acceptMatches(value, "text/plain")).toEqual(true);
  });

  it("handles explicit matches", () => {
    expect(acceptMatches("text/plain", "text/plain")).toEqual(true);
    expect(acceptMatches("text/plain; q=5", "text/plain")).toEqual(true);
  });

  it("handles wildcard subtypes", () => {
    expect(acceptMatches("text/*", "text/plain")).toEqual(true);
    expect(acceptMatches("text/*; q=5", "text/plain")).toEqual(true);
  });

  it("handles multiple acceptable values", () => {
    expect(acceptMatches("application/json, text/plain; q=5", "text/plain")).toEqual(true);
    expect(acceptMatches("application/json, text/*; q=5", "text/plain")).toEqual(true);
    expect(acceptMatches("application/json, text/xml; q=5, */*", "text/plain")).toEqual(true);
  });

  it.each(["application/*", "application/json", "application/*; q=5; text/xml"])(
    "does not match text/plain to %s",
    (value) => {
      expect(acceptMatches(value, "text/plain")).toEqual(false);
    }
  );
});
