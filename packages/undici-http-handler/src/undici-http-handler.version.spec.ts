import { readFileSync } from "node:fs";
import { join } from "node:path";
import { satisfies } from "compare-versions";
import { describe, expect, it } from "vitest";

describe("undici-http-handler version", () => {
  const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
  const packageVersion = packageJson.version;
  const undiciVersionRange = packageJson.dependencies["undici"];

  // Note: This check if added assuming undici publishes new major version when dropping support for Node.js
  it("package version should satisfy undici dependency range", () => {
    expect(satisfies(packageVersion, undiciVersionRange)).toBe(true);
  });
});
