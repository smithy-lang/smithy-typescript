import { describe, expect, test } from "vitest";

import { CodeInterceptor, CodeSection, SimpleCodeWriter } from "../../../src/codegen-core";

class FooSection implements CodeSection {
  public sectionName(): string {
    return "FooSection";
  }

  public getValue(): string {
    return "from-section";
  }
}

describe("format expressions", () => {
  test("relative $L and $S", () => {
    const w = new SimpleCodeWriter();
    expect(w.format("a $L b $S", 1, 'x"y')).toBe('a 1 b "x\\"y"');
  });

  test("$$ escapes", () => {
    expect(new SimpleCodeWriter().format("cost $$5")).toBe("cost $5");
  });

  test("explicit positionals", () => {
    expect(new SimpleCodeWriter().format("$2L $1L $2L", "a", "b")).toBe("b a b");
  });

  test("mixing positional and relative throws", () => {
    expect(() => new SimpleCodeWriter().format("$1L $L", "a", "b")).toThrow(/Cannot mix positional and relative/);
    expect(() => new SimpleCodeWriter().format("$L $1L", "a", "b")).toThrow(/Cannot mix positional and relative/);
  });

  test("unused arguments throw", () => {
    expect(() => new SimpleCodeWriter().format("$L", "a", "b")).toThrow(/unused relative format arguments/);
    expect(() => new SimpleCodeWriter().format("$1L", "a", "b")).toThrow(/unused positional format arguments/);
  });

  test("too few arguments throw", () => {
    expect(() => new SimpleCodeWriter().format("$L $L", "a")).toThrow(/attempted to format index 1/);
  });

  test("named arguments with and without braces", () => {
    const w = new SimpleCodeWriter().putContext("foo", "bar");
    expect(w.format("$foo:L ${foo:L}!")).toBe("bar bar!");
  });

  test("unknown formatter throws", () => {
    expect(() => new SimpleCodeWriter().format("$Z", "a")).toThrow(/Unknown formatter `Z`/);
  });

  test("conditionals", () => {
    const w = new SimpleCodeWriter().putContext("yes", true).putContext("no", false).putContext("empty", "");
    expect(w.format("${?yes}A${/yes}${?no}B${/no}${^no}C${/no}${?empty}D${/empty}")).toBe("AC");
  });

  test("conditional blocks on their own line drop the tag lines", () => {
    const w = new SimpleCodeWriter().putContext("yes", true);
    expect(w.format("a\n${?yes}\nb\n${/yes}\nc")).toBe("a\nb\nc");
  });

  test("loops expose key, value, first, and last", () => {
    const w = new SimpleCodeWriter().putContext("items", ["x", "y", "z"]);
    expect(w.format("${#items}${key:L}=${value:L}${^key.last}, ${/key.last}${/items}")).toBe("0=x, 1=y, 2=z");
  });

  test("loops over maps with custom names", () => {
    const w = new SimpleCodeWriter().putContext(
      "m",
      new Map([
        ["a", 1],
        ["b", 2],
      ])
    );
    expect(w.format("${#m as k, v}${k:L}:${v:L};${/m}")).toBe("a:1;b:2;");
  });

  test("unclosed block throws", () => {
    expect(() => new SimpleCodeWriter().format("${?a}x")).toThrow(/Unclosed parse conditional blocks: \[a\]/);
  });

  test("mismatched closing tag throws", () => {
    expect(() => new SimpleCodeWriter().format("${?a}x${/b}")).toThrow(/Invalid closing tag: 'b'. Expected: 'a'/);
  });

  test("block alignment keeps the column of the expression", () => {
    const w = new SimpleCodeWriter();
    expect(w.format("  x ${L|}", "a\nb")).toBe("  x a\n    b");
  });

  test("static whitespace block alignment", () => {
    expect(new SimpleCodeWriter().format("\t${L|}", "a\nb")).toBe("\ta\n\tb");
  });

  test("strip whitespace with ~", () => {
    expect(new SimpleCodeWriter().format("a  ${~L}  b", "X")).toBe("aX  b");
    expect(new SimpleCodeWriter().format("a ${L~}  b", "X")).toBe("a Xb");
  });

  test("$C runs a function and trims its trailing newline", () => {
    const w = new SimpleCodeWriter();
    expect(w.format("{ $C }", () => w.write("inner"))).toBe("{ inner }");
  });

  test("custom formatter", () => {
    const w = new SimpleCodeWriter().putFormatter("U", (v) => String(v).toUpperCase());
    expect(w.format("$U", "abc")).toBe("ABC");
  });

  test("invalid formatter identifier throws", () => {
    expect(() => new SimpleCodeWriter().putFormatter("a", (v) => String(v))).toThrow(/Invalid formatter identifier/);
  });
});

describe("indentation and state", () => {
  test("indent, dedent, and openBlock/closeBlock", () => {
    const w = new SimpleCodeWriter();
    w.openBlock("if (x) {", "}", () => {
      w.write("y();");
    });
    expect(w.toString()).toBe("if (x) {\n    y();\n}\n");
  });

  test("setIndentText", () => {
    const w = new SimpleCodeWriter().setIndentText("  ");
    w.write("a").indent().write("b").dedent().write("c");
    expect(w.toString()).toBe("a\n  b\nc\n");
  });

  test("dedent below zero throws", () => {
    expect(() => new SimpleCodeWriter().dedent()).toThrow(/Cannot dedent/);
  });

  test("trims trailing spaces on lines", () => {
    expect(new SimpleCodeWriter().write("a   ").toString()).toBe("a\n");
  });

  test("trimBlankLines collapses runs and trailing blanks", () => {
    const w = new SimpleCodeWriter().trimBlankLines();
    w.write("a").write("").write("").write("").write("b").write("").write("");
    expect(w.toString()).toBe("a\n\nb\n");
  });

  test("push and pop state restores indentation and context", () => {
    const w = new SimpleCodeWriter();
    w.pushState().indent().putContext("k", "v").write("$k:L");
    w.popState();
    w.write("${k:L}|");
    expect(w.toString()).toBe("    v\n|\n");
  });

  test("popping the root state throws", () => {
    expect(() => new SimpleCodeWriter().popState()).toThrow(/root state/);
  });

  test("newline prefix", () => {
    const w = new SimpleCodeWriter();
    w.write("/**").setNewlinePrefix(" * ").write("doc").setNewlinePrefix("").write(" */");
    expect(w.toString()).toBe("/**\n * doc\n */\n");
  });

  test("writeWithNoFormatting leaves expressions", () => {
    expect(new SimpleCodeWriter().writeWithNoFormatting("$L").toString()).toBe("$L\n");
  });
});

describe("sections", () => {
  test("onSection by name replaces content", () => {
    const w = new SimpleCodeWriter();
    w.onSection("greeting", (content) => w.write("[" + content + "]"));
    w.pushState("greeting").write("hello").popState();
    expect(w.toString()).toBe("[hello]\n");
  });

  test("interceptor by class receives the section and context from section getters", () => {
    const w = new SimpleCodeWriter();
    w.onSection(
      CodeInterceptor.appender(FooSection, (writer, section) => {
        writer.write("appended " + section.getValue());
      })
    );
    w.pushState(new FooSection()).write("body $value:L").popState();
    expect(w.toString()).toBe("body from-section\nappended from-section\n");
  });

  test("inline sections with $L@name", () => {
    const w = new SimpleCodeWriter();
    w.onSection("name", (content) => w.writeInlineWithNoFormatting(content.toUpperCase()));
    expect(w.format("hi ${L@name}!", "bob")).toBe("hi BOB!");
  });

  test("interceptors indent into the surrounding block", () => {
    const w = new SimpleCodeWriter();
    w.onSection("s", (content) => w.write("x").write(content));
    w.write("{").indent().pushState("s").write("y").popState().dedent().write("}");
    expect(w.toString()).toBe("{\n    x\n    y\n}\n");
  });

  test("injectSection runs interceptors with empty content", () => {
    const w = new SimpleCodeWriter();
    w.onSection("s", () => w.write("injected"));
    w.injectSection(CodeSection.forName("s"));
    expect(w.toString()).toBe("injected\n");
  });
});
