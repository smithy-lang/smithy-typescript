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
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const validationDir = __dirname;

const VALIDATIONS = [
  { name: "built", label: "all packages have build artifacts", script: "built.js" },
  { name: "imports-declared", label: "all package imports appear in package.json dependencies", script: "imports-declared.js" },
  { name: "relative-imports", label: "all relative imports are to paths that exist", script: "relative-imports.js" },
  { name: "deps-used", label: "all package.json dependencies are used", script: "deps-used.js" },
  { name: "no-unreachable-files", label: "no unreachable files", script: "unreachable-files.js" },
  { name: "no-dynamic-imports", label: "no dynamic imports with non-literal specifiers", script: "static-import-names.js" },
  { name: "no-cycles", label: "no cyclical file or package dependencies", script: "cycles.js" },
  { name: "eslint", label: "eslint passes on source", script: "eslint.js" },
  { name: "banned-imports", label: "no banned imports in dist output", script: "banned-imports.js" },
  { name: "export-names", label: "export function names match their keys", script: "export-names.js" },
  { name: "esm-compat", label: "dist-cjs exports visible via ESM import()", script: "esm-compat.js" },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const skip = new Set();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skip") {
      skip.add(args[++i]);
    }
  }

  return { skip };
}

function main() {
  const { skip } = parseArgs();

  console.log(`Running validations...\n`);

  const failures = [];
  const warnings = [];

  for (const { name, label, script } of VALIDATIONS) {
    if (skip.has(name)) {
      console.log(`⏭  ${label}`);
      continue;
    }

    try {
      const output = execFileSync("node", [path.join(validationDir, script)], {
        cwd: root,
        stdio: "pipe",
        encoding: "utf-8",
      });
      // Check if output contains warnings (⚠️).
      if (output.includes("⚠️")) {
        console.log(`⚠️  ${label}`);
        warnings.push({ label, output });
      } else {
        const countMatch = output.match(/\(([^)]+)\)\s*$/m);
        const countInfo = countMatch ? ` (${countMatch[1]})` : "";
        console.log(`✅ ${label}${countInfo}`);
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
