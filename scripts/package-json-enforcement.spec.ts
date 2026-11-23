import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import enforcePackageJson from "./package-json-enforcement";

const require = createRequire(import.meta.url);

function withPackage(sources: string[], check: (manifestPath: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "smithy-package-enforcement-"));
  const manifestPath = join(root, "package.json");
  try {
    for (const source of sources) {
      const file = join(root, "src", source);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "");
    }
    check(manifestPath);
  } finally {
    delete require.cache[manifestPath];
    rmSync(root, { recursive: true, force: true });
  }
}

function manifest(browser: Record<string, string> = {}, reactNative: Record<string, string> = {}) {
  return {
    name: "@smithy/test-variant-paths",
    main: "./dist-cjs/index.js",
    module: "./dist-es/index.js",
    files: ["dist-*/**"],
    browser,
    "react-native": reactNative,
    scripts: {
      build: "yarn g:tsc -p tsconfig.cjs.json && yarn g:tsc -p tsconfig.es.json && yarn g:tsc -p tsconfig.types.json",
      "build:types": "premove dist-types && yarn g:tsc -p tsconfig.types.json",
      clean: "premove dist-cjs dist-es dist-types",
    },
    devDependencies: { premove: "4.0.0" },
  };
}

describe("package variant manifest paths", () => {
  for (const { name, sources, browser, native } of [
    {
      name: "browser variant",
      sources: ["index.ts", "index.browser.ts"],
      browser: { "./dist-es/index": "./dist-es/index.browser" },
      native: {
        "./dist-es/index": "./dist-es/index.browser",
        "./dist-cjs/index": "./dist-cjs/index.browser",
      },
    },
    {
      name: "nested browser variant",
      sources: ["nested/index.ts", "nested/index.browser.ts"],
      browser: { "./dist-es/nested/index": "./dist-es/nested/index.browser" },
      native: {
        "./dist-es/nested/index": "./dist-es/nested/index.browser",
        "./dist-cjs/nested/index": "./dist-cjs/nested/index.browser",
      },
    },
    {
      name: "native variant",
      sources: ["index.ts", "index.native.ts"],
      browser: {},
      native: {
        "./dist-es/index": "./dist-es/index.native",
        "./dist-cjs/index": "./dist-cjs/index.native",
      },
    },
    {
      name: "native precedence over browser fallback",
      sources: ["index.ts", "index.browser.ts", "index.native.ts"],
      browser: { "./dist-es/index": "./dist-es/index.browser" },
      native: {
        "./dist-es/index": "./dist-es/index.native",
        "./dist-cjs/index": "./dist-cjs/index.native",
      },
    },
  ]) {
    it(`validates ${name} without changing the manifest`, () => {
      withPackage(sources, (manifestPath) => {
        const content = JSON.stringify(manifest(browser, native), null, 2) + "\n";
        writeFileSync(manifestPath, content);

        expect(enforcePackageJson(manifestPath)).toEqual([]);
        expect(readFileSync(manifestPath, "utf8")).toBe(content);
      });
    });

    it(`writes portable mappings for ${name}`, () => {
      withPackage(sources, (manifestPath) => {
        writeFileSync(manifestPath, JSON.stringify(manifest()));

        expect(enforcePackageJson(manifestPath, true).length).toBeGreaterThan(0);
        const updated = JSON.parse(readFileSync(manifestPath, "utf8"));
        expect(updated.browser).toEqual(browser);
        expect(updated["react-native"]).toEqual(native);
        expect(enforcePackageJson(manifestPath)).toEqual([]);
        const content = readFileSync(manifestPath, "utf8");
        expect(enforcePackageJson(manifestPath, true)).toEqual([]);
        expect(readFileSync(manifestPath, "utf8")).toBe(content);
      });
    });
  }

  it("ignores variant-named test files", () => {
    withPackage(["index.ts", "index.browser.spec.ts", "index.native.integ.ts"], (manifestPath) => {
      writeFileSync(manifestPath, JSON.stringify(manifest()));
      expect(enforcePackageJson(manifestPath)).toEqual([]);
    });
  });

  it("still reports mappings whose source variant is missing", () => {
    withPackage(["index.ts"], (manifestPath) => {
      const browser = { "./dist-es/index": "./dist-es/index.browser" };
      const native = { ...browser, "./dist-cjs/index": "./dist-cjs/index.browser" };
      const content = JSON.stringify(manifest(browser, native));
      writeFileSync(manifestPath, content);

      expect(enforcePackageJson(manifestPath)).toEqual([
        expect.stringContaining("has no corresponding source file"),
        expect.stringContaining("has no corresponding source file"),
        expect.stringContaining("has no corresponding source file"),
      ]);
      expect(readFileSync(manifestPath, "utf8")).toBe(content);
    });
  });
});
