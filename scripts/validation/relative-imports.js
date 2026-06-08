#!/usr/bin/env node

/**
 * For every relative import/require in dist-cjs and dist-es, validates that
 * the target file exists.
 *
 * Usage: node relative-imports.js <packageDir> [...]
 */

const fs = require("node:fs");
const path = require("node:path");
const walk = require("../utils/walk");
const { extractImports, resolveRelative, getPackageDirs, summarizePackages } = require("./validation-shared");

/**
 * @param packageDir - package root.
 * @param pkgJson - parsed package.json.
 * @param distName - "dist-cjs" or "dist-es".
 * @returns error messages for broken relative imports.
 */
async function validateDist(packageDir, pkgJson, distName) {
  const distDir = path.join(packageDir, distName);
  if (!fs.existsSync(distDir)) {
    return [];
  }

  const errors = [];
  for await (const file of walk(distDir, ["node_modules"])) {
    if (!file.endsWith(".js")) {
      continue;
    }
    const code = fs.readFileSync(file, "utf-8");
    for (const specifier of extractImports(code)) {
      if (!specifier.startsWith(".")) {
        continue;
      }
      if (!resolveRelative(file, specifier)) {
        errors.push(`[${pkgJson.name}/${distName}] ${specifier} not found (from ${path.relative(packageDir, file)})`);
      }
    }
  }
  return errors;
}

/**
 * @param packageDir - package root.
 * @returns aggregated errors from both dist directories, or null if skipped.
 */
async function validate(packageDir) {
  const pkgJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    return null;
  }
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  const errors = [];
  for (const dist of ["dist-cjs", "dist-es"]) {
    errors.push(...(await validateDist(packageDir, pkgJson, dist)));
  }
  return errors;
}

async function main() {
  const packages = getPackageDirs();
  const validated = [];
  const errors = [];
  for (const pkg of packages) {
    const pkgErrors = await validate(pkg.dir);
    if (pkgErrors !== null) {
      validated.push(pkg);
      errors.push(...pkgErrors);
    }
  }
  if (errors.length) {
    console.error(`❌ ${errors.length} broken relative import(s):\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✅ All relative imports resolve to existing files. (${summarizePackages(validated)})`);
}

main();
