import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import buildEs from "./build-es";

describe("ES build compiler launcher", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["package", "package with spaces & (parentheses)"])("compiles %s without relying on PATH", (name) => {
    const root = mkdtempSync(join(tmpdir(), "smithy-build-es-"));
    const packageDir = join(root, name);
    try {
      mkdirSync(join(packageDir, "src"), { recursive: true });
      mkdirSync(join(packageDir, "dist-es"));
      writeFileSync(join(packageDir, "src", "index.ts"), "export const answer: number = 42;\n");
      writeFileSync(join(packageDir, "dist-es", "stale.js"), "old output");
      writeFileSync(
        join(packageDir, "tsconfig.es.json"),
        JSON.stringify({
          compilerOptions: {
            module: "esnext",
            target: "es2022",
            noCheck: true,
            types: [],
            rootDir: "src",
            outDir: "dist-es",
          },
          include: ["src/**/*.ts"],
        })
      );
      vi.stubEnv("PATH", "");

      buildEs(packageDir);

      expect(readFileSync(join(packageDir, "dist-es", "index.js"), "utf8")).toBe("export const answer = 42;\n");
      expect(existsSync(join(packageDir, "dist-es", "stale.js"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
