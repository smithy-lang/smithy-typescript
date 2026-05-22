#!/usr/bin/env node

/**
 * Orchestrator: runs all validation scripts against specified package directories.
 *
 * Usage:
 *   node validate-all.js <packageDir> [<packageDir> ...]
 *   node validate-all.js --all              # runs on all packages/* dirs
 *   node validate-all.js --skip eslint      # skip specific checks
 *
 * Options:
 *   --all           Run on all packages in packages/
 *   --skip <name>   Skip a validation (repeatable). Names: imports-declared,
 *                   relative-imports, deps-used, no-unreachable-files, eslint
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const validationDir = __dirname;

const VALIDATIONS = [
  { name: "imports-declared", label: "all package imports appear in package.json dependencies", script: "validate-imports-declared.js" },
  { name: "relative-imports", label: "all relative imports are to paths that exist", script: "validate-relative-imports.js" },
  { name: "deps-used", label: "all package.json dependencies are used", script: "validate-deps-used.js" },
  { name: "no-unreachable-files", label: "no unreachable files", script: "validate-no-unreachable-files.js" },
  { name: "no-dynamic-imports", label: "no dynamic imports with non-literal specifiers", script: "validate-no-dynamic-imports.js" },
  { name: "eslint", label: "eslint passes on source", script: "validate-eslint.js" },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const dirs = [];
  const skip = new Set();
  let useAll = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") {
      useAll = true;
    } else if (args[i] === "--skip") {
      skip.add(args[++i]);
    } else {
      dirs.push(path.resolve(args[i]));
    }
  }

  if (useAll) {
    const packagesDir = path.join(root, "packages");
    for (const folder of fs.readdirSync(packagesDir)) {
      const pkgDir = path.join(packagesDir, folder);
      if (fs.existsSync(path.join(pkgDir, "package.json"))) {
        dirs.push(pkgDir);
      }
    }
  }

  return { dirs, skip };
}

function main() {
  const { dirs, skip } = parseArgs();

  if (!dirs.length) {
    console.error("Usage: validate-all.js [--all] [--skip <name>] <packageDir> [...]");
    process.exit(1);
  }

  console.log(`Running validations on ${dirs.length} package(s)...\n`);

  const failures = [];
  const warnings = [];

  for (const { name, label, script } of VALIDATIONS) {
    if (skip.has(name)) {
      console.log(`⏭  ${label}`);
      continue;
    }

    try {
      const output = execFileSync("node", [path.join(validationDir, script), ...dirs], {
        cwd: root,
        stdio: "pipe",
        encoding: "utf-8",
      });
      // Check if output contains warnings (⚠️).
      if (output.includes("⚠️")) {
        console.log(`⚠️  ${label}`);
        warnings.push({ label, output });
      } else {
        console.log(`✅ ${label}`);
      }
    } catch (e) {
      console.log(`❌ ${label}`);
      failures.push({ label, output: e.stdout || e.stderr || e.message });
    }
  }

  if (warnings.length) {
    console.log("");
    for (const { label, output } of warnings) {
      console.log(`--- ${label} ---\n${output}`);
    }
  }

  console.log("");
  if (failures.length) {
    console.error(`${failures.length}/${VALIDATIONS.length - skip.size} validation(s) failed:\n`);
    for (const { label, output } of failures) {
      console.error(`--- ${label} ---\n${output}\n`);
    }
    process.exit(1);
  }
  console.log(`All validations passed.`);
}

main();
