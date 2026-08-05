#!/usr/bin/env node

/**
 * For every declared dependency in package.json, validates that it is
 * actually imported somewhere in the package's dist-cjs, dist-es, or dist-types.
 *
 * Usage: node deps-used.js <packageDir> [...]
 */

const fs = require("node:fs");
const path = require("node:path");
const walk = require("../utils/walk");
const { getPackageName, extractImports, getPackageDirs, summarizePackages } = require("./validation-shared");

const IMPLICIT_DEPS = new Set(["tslib"]);
const DTS_IMPORT_RE = /from\s+["']([^"']+)["']/g;
const TS_IMPORT_RE = /(?:import|from)\s+["']([^"']+)["']/g;

/**
 * @param packageDir - package root.
 * @returns error messages for unused dependencies, or null if skipped.
 */
async function validate(packageDir) {
  const pkgJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    return null;
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

  const declared = new Set(Object.keys(pkgJson.dependencies || {}));
  const used = new Set();

  // Scan compiled JS.
  for (const dist of ["dist-cjs", "dist-es"]) {
    const distDir = path.join(packageDir, dist);
    if (!fs.existsSync(distDir)) {
      continue;
    }
    for await (const file of walk(distDir, ["node_modules"])) {
      if (!file.endsWith(".js")) {
        continue;
      }
      const code = fs.readFileSync(file, "utf-8");
      for (const specifier of extractImports(code)) {
        if (specifier.startsWith(".") || specifier.startsWith("node:")) {
          continue;
        }
        used.add(getPackageName(specifier));
      }
    }
  }

  // Scan .d.ts for type-only imports erased from JS.
  const distTypes = path.join(packageDir, "dist-types");
  if (fs.existsSync(distTypes)) {
    for await (const file of walk(distTypes, ["node_modules"])) {
      if (!file.endsWith(".d.ts")) {
        continue;
      }
      const contents = fs.readFileSync(file, "utf-8");
      let m;
      DTS_IMPORT_RE.lastIndex = 0;
      while ((m = DTS_IMPORT_RE.exec(contents)) !== null) {
        if (m[1].startsWith(".") || m[1].startsWith("node:")) {
          continue;
        }
        used.add(getPackageName(m[1]));
      }
    }
  }

  // Scan source .ts files for type-only imports that may be erased from both
  // JS output and .d.ts (e.g. when used only in function body type annotations).
  const srcDir = path.join(packageDir, "src");
  if (fs.existsSync(srcDir)) {
    for await (const file of walk(srcDir, ["node_modules"])) {
      if (!file.endsWith(".ts") || file.endsWith(".d.ts") || file.endsWith(".spec.ts") || file.endsWith(".bench.ts")) {
        continue;
      }
      const contents = fs.readFileSync(file, "utf-8");
      let m;
      TS_IMPORT_RE.lastIndex = 0;
      while ((m = TS_IMPORT_RE.exec(contents)) !== null) {
        if (m[1].startsWith(".") || m[1].startsWith("node:")) {
          continue;
        }
        used.add(getPackageName(m[1]));
      }
    }
  }

  const errors = [];
  for (const dep of declared) {
    if (IMPLICIT_DEPS.has(dep)) {
      continue;
    }
    // @types/X packages provide type declarations for imports of "X".
    if (dep.startsWith("@types/")) {
      const bareModule = dep.slice("@types/".length);
      if (used.has(bareModule)) {
        continue;
      }
    }
    if (!used.has(dep)) {
      errors.push(`${dep} declared but never imported in ${pkgJson.name}`);
    }
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
    console.error(`❌ ${errors.length} unused dependency declaration(s):\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✅ All declared dependencies are imported. (${summarizePackages(validated)})`);
}

main();
