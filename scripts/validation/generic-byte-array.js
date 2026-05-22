#!/usr/bin/env node

/**
 * Runs after a full build to assert that Uint8Array was not generated with a type parameter
 * by TypeScript, which is only compatible with TypeScript 5.7.
 */

const walk = require("../utils/walk");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");

const packages = path.join(root, "packages");

(async () => {
  const errors = [];
  for (const folder of fs.readdirSync(packages)) {
    const packagePath = path.join(packages, folder);
    const distTypes = path.join(packagePath, "dist-types");
    if (fs.existsSync(distTypes)) {
      for await (const file of walk(distTypes)) {
        const contents = fs.readFileSync(file, "utf-8");
        if (contents.includes("Uint8Array<")) {
          errors.push(file);
        }
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `The following files used Uint8Array in a generic way, only compatible with TypeScript 5.7:\n\t${errors.join(
        "\n\t"
      )}`
    );
  } else {
    console.log(`✅ No Uint8Arrays with type parameters.`);
  }
})();
