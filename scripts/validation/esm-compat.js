#!/usr/bin/env node

/**
 * Validates that dist-cjs named exports are visible via ESM import().
 * This confirms cjs-module-lexer can parse the generated CJS output.
 *
 * Usage: node esm-compat.js
 */

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { getPackageDirs, summarizePackages } = require("./validation-shared");

async function main() {
  const packages = getPackageDirs();
  const errors = [];
  const validated = [];

  for (const { dir } of packages) {
    const indexPath = path.join(dir, "dist-cjs", "index.js");
    if (!fs.existsSync(indexPath)) {
      continue;
    }

    const pkgJson = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));

    let cjsExports, esmNamespace;
    try {
      cjsExports = Object.keys(require(indexPath));
    } catch {
      continue;
    }

    try {
      esmNamespace = await import(pathToFileURL(indexPath).href);
    } catch (e) {
      errors.push(`[${path.basename(dir)}] import() failed: ${e.message}`);
      continue;
    }

    validated.push({ dir });
    const esmKeys = Object.keys(esmNamespace).filter((k) => k !== "default" && k !== "__esModule");
    const missing = cjsExports.filter((k) => !esmKeys.includes(k));

    if (missing.length) {
      errors.push(
        `[${pkgJson.name}] ${missing.length} exports not visible via import(): ${missing.slice(0, 5).join(", ")}${
          missing.length > 5 ? "..." : ""
        }`
      );
    }
  }

  if (errors.length) {
    console.error(`❌ ${errors.length} ESM compat issue(s):\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✅ All dist-cjs exports visible via import(). (${summarizePackages(validated)})`);
}

main();
