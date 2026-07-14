#!/usr/bin/env node

/**
 * Bans `export *` (ExportAllDeclaration) in package source files.
 * Enforces explicit named exports for better tree-shaking and API clarity.
 *
 * Usage: node no-export-star.js [<packageDir> ...]
 */

const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("acorn");
const walk = require("../utils/walk");
const { getPackageDirs, summarizePackages } = require("./validation-shared");

/**
 * @param {string} file - absolute path to a .ts source file.
 * @returns {Array<{line: number}>} locations of export * declarations.
 */
function findExportStar(file) {
  const code = fs.readFileSync(file, "utf-8");
  let ast;
  try {
    ast = parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowImportExportEverywhere: true,
      locations: true,
    });
  } catch {
    // If acorn can't parse (e.g. TypeScript syntax), fall back to regex.
    const hits = [];
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*export\s+\*\s+from\s/.test(line) || /^\s*export\s+\*\s*;/.test(line)) {
        hits.push({ line: i + 1 });
      }
    }
    return hits;
  }

  const hits = [];
  for (const node of ast.body) {
    if (node.type === "ExportAllDeclaration") {
      hits.push({ line: node.loc?.start?.line ?? 0 });
    }
  }
  return hits;
}

/**
 * @param {string} packageDir - package root.
 * @returns {string[]} formatted error messages.
 */
async function validate(packageDir) {
  const srcDir = path.join(packageDir, "src");
  if (!fs.existsSync(srcDir)) {
    return [];
  }
  const pkgJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    return [];
  }
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

  const errors = [];
  for await (const file of walk(srcDir, ["node_modules"])) {
    if (!file.endsWith(".ts") || file.endsWith(".d.ts") || file.endsWith(".spec.ts")) {
      continue;
    }
    const hits = findExportStar(file);
    for (const { line } of hits) {
      const rel = path.relative(packageDir, file);
      errors.push(`[${pkgJson.name}] ${rel}:${line} - Use explicit named exports instead of 'export *'.`);
    }
  }
  return errors;
}

async function main() {
  const packages = getPackageDirs();
  const validated = [];
  const errors = [];

  for (const pkg of packages) {
    if (pkg.generated) {
      continue;
    }
    const pkgErrors = await validate(pkg.dir);
    validated.push(pkg);
    errors.push(...pkgErrors);
  }

  if (errors.length) {
    console.error(`❌ ${errors.length} 'export *' usage(s) found:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✅ No 'export *' found. (${summarizePackages(validated)})`);
}

main();
