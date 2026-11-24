import { describe, expect, test } from "vitest";

import { SimpleCodeWriter } from "../../../src/codegen-core";
import reference from "./java-reference.json";

const ref = reference as Record<string, string>;

function writer(): SimpleCodeWriter {
  return new SimpleCodeWriter()
    .putContext("yes", true)
    .putContext("items", ["x", "y"])
    .putContext("m", new Map([["k", "v"]]));
}

describe("format expressions match the Java implementation", () => {
  test("conditional tags on their own line", () => {
    expect(writer().format("a\n  ${?yes}\n  b\n  ${/yes}\nc")).toBe(ref.c1);
  });

  test("inline conditional", () => {
    expect(writer().format("x ${?yes}in${/yes} y")).toBe(ref.c2);
  });

  test("whitespace stripping on conditionals", () => {
    expect(writer().format("a  \n${~?yes}  b ${/yes}  \n  c")).toBe(ref.c3);
  });

  test("loops with first and last", () => {
    expect(writer().format("${#items}\n- ${value:L}${^key.last},${/key.last}\n${/items}")).toBe(ref.c4);
  });

  test("block alignment", () => {
    expect(writer().format("{\n  ${L|}\n}", "l1\nl2")).toBe(ref.c5);
    expect(writer().format("pre ${L|} post", "l1\nl2")).toBe(ref.c6);
  });

  test("map loops", () => {
    expect(writer().format("${#m as k, v}$k:L=$v:L;${/m}")).toBe(ref.c7);
  });

  test("inline sections without interceptors", () => {
    expect(writer().format("${L@sec} and ${S@sec2}", "q", "r")).toBe(ref.c8);
  });

  test("escaped expression start and list literals", () => {
    expect(writer().format("$$ $$L $L", [1, 2])).toBe(ref.c9);
  });
});

describe("writer output matches the Java implementation", () => {
  test("indentation with nested state", () => {
    const x = new SimpleCodeWriter();
    x.write("a").indent().write("b\nc").pushState().indent().write("d").popState().dedent().write("e");
    expect(x.toString()).toBe(ref.w1);
  });

  test("newline prefix with trimmed trailing spaces", () => {
    const y = new SimpleCodeWriter();
    y.setNewlinePrefix("// ").write("a\n\nb");
    expect(y.toString()).toBe(ref.w2);
  });

  test("inline writes", () => {
    const z = new SimpleCodeWriter();
    z.writeInline("a").writeInline("b").write("c").writeInline("d");
    expect(z.toString()).toBe(ref.w3);
  });

  test("unwrite and ensureNewline", () => {
    const u = new SimpleCodeWriter();
    u.write("x").unwrite("x\n");
    u.write("y").ensureNewline().write("z");
    expect(u.toString()).toBe(ref.w4);
  });

  test("trimBlankLines(0)", () => {
    const t = new SimpleCodeWriter().trimBlankLines(0);
    t.write("a\n\n\nb\n\n");
    expect(t.toString()).toBe(ref.w5);
  });
});
