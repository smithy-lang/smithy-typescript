import { describe, expect, test } from "vitest";

import { ImportDeclarations } from "../../../src/typescript/ImportDeclarations";
import { SmithyCoreSubmodules } from "../../../src/typescript/SmithyCoreSubmodules";
import { TypeScriptDependency } from "../../../src/typescript/TypeScriptDependency";
import { TypeScriptUtils } from "../../../src/typescript/TypeScriptUtils";
import { TypeScriptWriter, TypeScriptWriterFactory } from "../../../src/typescript/TypeScriptWriter";
import reference from "./fixtures/java-reference.json";

const ref = reference as Record<string, string>;

describe("ImportDeclarations", () => {
  test("orders, relativizes, and dedupes like the Java implementation", () => {
    const d = new ImportDeclarations("models/index");
    d.addImport("Zed", null, "@smithy/types");
    d.addImport("alpha", "beta", "@smithy/types");
    d.addTypeImport("Type1", null, "@smithy/types");
    d.addTypeImport("Type2", "T2", "@smithy/types");
    d.addImport("Foo", null, "./Foo");
    d.addImport("Bar", null, "../commands/Bar");
    d.addImport("Up", null, "../../Up");
    d.addImport("Self", null, "./index");
    d.addTypeImport("OnlyType", null, "./OnlyType");
    d.addTypeImport("OnlyType2", null, "@aws-sdk/Types");
    d.addImport("A", null, "Beta-pkg");
    d.addImport("B", null, "alpha-pkg");
    d.addIgnoredDefaultImport("pkg", "../package.json", "json");
    expect(d.toString()).toBe(ref.imports1);
  });

  test("wraps long import lists and renders type-only imports", () => {
    const e = new ImportDeclarations("index");
    for (const c of ["A", "B", "C"]) {
      e.addImport(c.repeat(30), null, "@smithy/some-long-package-name");
    }
    e.addTypeImport("X".repeat(40), null, "@smithy/types");
    e.addTypeImport("Y".repeat(40), null, "@smithy/types");
    e.addTypeImport("Z".repeat(40), "Zed", "@smithy/types");
    e.addImport("Foo", null, "./models/Foo");
    e.addImport("Foo", null, "./commands");
    expect(e.toString()).toBe(ref.imports2);
  });

  test("relativizes parent directories", () => {
    const f = new ImportDeclarations("a/b/c");
    f.addImport("F", null, "./x");
    f.addImport("G", null, "../g");
    f.addImport("H", null, "../../h");
    f.addImport("I", null, "../../../i");
    f.addImport("J", null, "./");
    f.addImport("K", null, ".");
    f.addImport("L", null, "..");
    expect(f.toString()).toBe(ref.imports3);
  });

  test("star imports are rejected", () => {
    const d = new ImportDeclarations("x");
    d.addImport("*", "all", "pkg");
    expect(() => d.toString()).toThrow(/Star imports are not supported/);
  });

  test("renders nothing without imports", () => {
    expect(new ImportDeclarations("x").toString()).toBe("");
  });
});

describe("TypeScriptWriter", () => {
  test("renders imports, docs, and blocks like the Java implementation", () => {
    const w = new TypeScriptWriter("foo/bar");
    w.addDependency(TypeScriptDependency.SMITHY_TYPES);
    w.addImport("Z", null, TypeScriptDependency.SMITHY_TYPES);
    w.addTypeImport("MetadataBearer", "__MetadataBearer", TypeScriptDependency.SMITHY_TYPES);
    w.addImportSubmodule("cbor", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR);
    w.addImport("fs", null, "fs");
    w.addRelativeImport("Rel", null, "./sibling");
    w.writeDocs("Hello $L */ {x}\nline2");
    w.write("export const x = $S;", 'a"b$');
    w.openBlock("if (a) {", "}", () => w.write("b();"));
    expect(w.toString()).toBe(ref.writer1);
  });

  test("keeps explicit imports adjacent to managed imports", () => {
    const w = new TypeScriptWriter("foo/bar");
    w.addIgnoredDefaultImport("x", "y", "why");
    w.write('import { a } from "b";\n\nconst q = 1;');
    expect(w.toString()).toBe(ref.writer2);
  });

  test("strips leading blank lines of the body", () => {
    const w = new TypeScriptWriter("foo/bar");
    w.write("\n\n  const q = $L;", 1);
    expect(w.toString()).toBe(ref.writer3);
  });

  test("collapsible blocks", () => {
    const w = new TypeScriptWriter("foo/bar");
    w.openCollapsibleBlock("class A {", "}", false, () => w.write("x"));
    w.openCollapsibleBlock("class B {", "}", true, () => w.write("x"));
    w.openCollapsibleBlock("class $L {", "}", true, "C", () => w.write("x"));
    w.openCollapsibleBlock("class $L {", "}", false, "D", () => w.write("x"));
    expect(w.toString()).toBe(ref.writer4);
  });

  test("punctuate", () => {
    expect(
      [TypeScriptWriter.punctuate("abc "), TypeScriptWriter.punctuate("abc."), TypeScriptWriter.punctuate("a\nb")].join(
        "|"
      )
    ).toBe(ref.punct);
  });

  test("importing an unregistered package throws", () => {
    const w = new TypeScriptWriter("foo");
    expect(() => w.addImport("A", null, "@smithy/unregistered")).toThrow(
      /does not correspond to a registered dependency/
    );
  });

  test("docs escape comment terminators and formatter characters", () => {
    const w = new TypeScriptWriter("foo");
    w.writeDocs("a */ b $L");
    expect(w.toString()).toContain("/**\n * a *\\/ b $L\n */\n");
  });

  test("factory omits attribution for non-.ts files", () => {
    expect(TypeScriptWriterFactory("README.md", "").toString()).not.toContain("smithy-typescript generated code");
    expect(TypeScriptWriterFactory("a/b.ts", "").getModuleName()).toBe("a/b");
  });

  test("$T registers imports for symbols", () => {
    const w = new TypeScriptWriter("foo/bar");
    const symbol = TypeScriptDependency.SMITHY_TYPES.createSymbol("Foo");
    w.write("let x: $T;", symbol);
    expect(w.toString()).toContain('import { Foo } from "@smithy/types";');
    expect(w.getDependencies().map((d) => d.getPackageName())).toEqual(["@smithy/types"]);
  });
});

describe("TypeScriptDependency", () => {
  test("versions match the Java implementation", () => {
    const d = TypeScriptDependency;
    const actual = [d.SMITHY_TYPES, d.SMITHY_CORE, d.SERVER_COMMON, d.BIG_JS, d.AWS_SDK_TYPES].map((x) => x.version);
    expect(actual.join(" ")).toBe(ref.deps);
  });

  test("unconditional dependencies", () => {
    const names = TypeScriptDependency.getUnconditionalDependencies().map((d) => d.getPackageName());
    expect(names).toEqual(["@smithy/types", "@types/node"]);
  });
});

describe("TypeScriptUtils", () => {
  test("property names and enum variants", () => {
    const out = [
      TypeScriptUtils.sanitizePropertyName("a-b"),
      TypeScriptUtils.sanitizePropertyName("ab"),
      TypeScriptUtils.sanitizePropertyName("1a"),
      TypeScriptUtils.getEnumVariants(["b", 'a"c']),
    ];
    expect(`${out[0]} ${out[1]} ${out[2]} ${out[3]}`).toBe(ref.utils);
  });
});
