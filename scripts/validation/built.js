#!/usr/bin/env node

/**
 * Validates that all packages have been built (dist artifacts exist).
 *
 * Usage: node built.js
 */

const fs = require("node:fs");
const path = require("node:path");
const { getPackageDirs, summarizePackages } = require("./validation-shared");

const REQUIRED_FILES = ["dist-es/index.js", "dist-cjs/index.js", "dist-types/index.d.ts"];

function main() {
  const packages = getPackageDirs();
  const validated = [];
  const errors = [];
  for (const pkg of packages) {
    const pkgJsonPath = path.join(pkg.dir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;
    validated.push(pkg);
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    for (const file of REQUIRED_FILES) {
      if (!fs.existsSync(path.join(pkg.dir, file))) {
        errors.push(`${pkgJson.name} missing ${file}`);
      }
    }
  }
  if (errors.length) {
    console.error(`❌ ${errors.length} package(s) not built:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✅ All packages have build artifacts. (${summarizePackages(validated)})`);
}

main();
