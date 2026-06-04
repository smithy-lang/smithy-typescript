#!/usr/bin/env node

/**
 * Runs eslint in validation mode (no --fix) on package source.
 * Spawns a single eslint process for all packages.
 *
 * Usage: node eslint.js <packageDir> [<packageDir> ...]
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { getPackageDirs } = require("./validation-shared");

const root = path.join(__dirname, "..", "..");
const eslintConfig = path.join(root, ".eslintrc.js");

function main() {
  const packages = getPackageDirs();

  const globs = [];
  for (const { dir, generated } of packages) {
    if (generated) {
      continue;
    }
    const srcDir = path.join(dir, "src");
    if (fs.existsSync(srcDir)) {
      globs.push(`${srcDir}/**/*.ts`);
    }
  }

  if (!globs.length) {
    console.log("✅ ESLint passed (no source found).");
    return;
  }

  try {
    const output = execFileSync("npx", ["eslint", "--quiet", "-c", eslintConfig, "--format", "json", ...globs], {
      cwd: root,
      stdio: "pipe",
      encoding: "utf-8",
    });
    const results = JSON.parse(output);
    const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
    if (errorCount > 0) {
      // Re-run with default formatter for readable output.
      execFileSync("npx", ["eslint", "--quiet", "-c", eslintConfig, ...globs], {
        cwd: root,
        stdio: "pipe",
        encoding: "utf-8",
      });
    }
    console.log(`✅ ESLint passed (${results.length} files).`);
  } catch (e) {
    // eslint exits non-zero on lint errors OR if --format json still outputs parseable JSON
    let output = e.stdout || "";
    try {
      const results = JSON.parse(output);
      const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
      if (errorCount === 0) {
        console.log(`✅ ESLint passed (${results.length} files).`);
        return;
      }
    } catch {}
    // Re-run with stylish output for readable errors.
    try {
      execFileSync("npx", ["eslint", "--quiet", "-c", eslintConfig, ...globs], {
        cwd: root,
        stdio: "pipe",
        encoding: "utf-8",
      });
    } catch (e2) {
      console.error(`❌ ESLint failed:\n${e2.stdout || e2.stderr || e2.message}`);
      process.exit(1);
    }
  }
}

main();
