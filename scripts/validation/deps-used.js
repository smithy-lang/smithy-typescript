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
const { getPackageName, extractImports, getPackageDirs } = require("./validation-shared");

const IMPLICIT_DEPS = new Set(["tslib"]);
const DTS_IMPORT_RE = /from\s+["']([^"']+)["']/g;

/**
 * @param packageDir - package root.
 * @returns error messages for unused dependencies.
 */
async function validate(packageDir) {
  const pkgJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    return [];
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  if (pkgJson.name === "@smithy/undici-http-handler") {
    const nodeMajorVersion = parseInt(process.versions.node.split(".")[0], 10);
    // @smithy/undici-http-handler depends on undici@7, which requires Node.js >= 20.
    // Skip validation, as the package isn't built.
    if (nodeMajorVersion < 20) {
      return [];
    }
  }

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

  const errors = [];
  for (const dep of declared) {
    if (IMPLICIT_DEPS.has(dep)) {
      continue;
    }
    if (!used.has(dep)) {
      errors.push(`${dep} declared but never imported in ${pkgJson.name}`);
    }
  }
  return errors;
}

async function main() {
  const packages = getPackageDirs();
  const errors = [];
  for (const { dir } of packages) {
    errors.push(...(await validate(dir)));
  }
  if (errors.length) {
    console.error(`❌ ${errors.length} unused dependency declaration(s):\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log("✅ All declared dependencies are imported.");
}

main();
