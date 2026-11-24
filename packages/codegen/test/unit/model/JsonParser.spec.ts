import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { javaNumberToString } from "../../../src/model/node/JavaNumbers";
import { JsonParser } from "../../../src/model/node/JsonParser";

const FIXTURES = join(__dirname, "../../fixtures");

describe("JsonParser", () => {
  const SAMPLE =
    '{"a":[2.0,1e30,-0.100000000000000000000001],"b":{"c":9223372036854775808},"__proto__":1,"s":"x\\u0041\\n"}';

  describe.each([
    ["custom parser", false],
    ["reviver", true],
  ])("%s", (_name, preferReviver) => {
    test("matches JSON.parse on the projection fixtures", () => {
      for (const projection of readdirSync(FIXTURES)) {
        const text = readFileSync(join(FIXTURES, projection, "model.json"), "utf-8");
        expect(JsonParser.parse(text, preferReviver)).toEqual(JSON.parse(text));
      }
    });

    test("records the source text of numbers by holder and key", () => {
      const parsed = JsonParser.parse(SAMPLE, preferReviver) as Record<string, any>;
      expect(JsonParser.getNumberSource(parsed.a, 0)).toBe("2.0");
      expect(JsonParser.getNumberSource(parsed.a, 1)).toBe("1e30");
      expect(JsonParser.getNumberSource(parsed.a, 2)).toBe("-0.100000000000000000000001");
      expect(JsonParser.getNumberSource(parsed.b, "c")).toBe("9223372036854775808");
      expect(Object.keys(parsed)).toContain("__proto__");
      expect(parsed.s).toBe("xA\n");
    });
  });

  test("rejects malformed JSON like JSON.parse", () => {
    for (const text of ["{", "[1,]", '{"a" 1}', "01", "1.", '"\\x"', "tru", "[1] 2"]) {
      expect(() => JSON.parse(text)).toThrow(SyntaxError);
      expect(() => JsonParser.parse(text, false)).toThrow(SyntaxError);
    }
  });
});

describe("javaNumberToString", () => {
  test.each([
    ["2", "2"],
    ["9223372036854775808", "9223372036854775808"],
    ["-9223372036854775809", "-9223372036854775809"],
    ["2.0", "2.0"],
    ["0.0", "0.0"],
    ["0.1", "0.1"],
    ["4.76837158203125E-6", "4.76837158203125E-6"],
    ["946845296.123", "9.46845296123E8"],
    ["1e30", "1.0E30"],
    ["0.100000000000000000000001", "0.100000000000000000000001"],
    ["-0.100000000000000000000001", "-0.100000000000000000000001"],
    ["100000000000000000000001.0", "100000000000000000000001.0"],
    ["1e400", "1E+400"],
  ])("%s prints as %s", (lexeme, expected) => {
    expect(javaNumberToString(lexeme)).toBe(expected);
  });
});
