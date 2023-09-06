/**
 * Example script for iterating packages.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packages = path.join(root, "packages");

for (const folder of fs.readdirSync(packages)) {
  const pkgJson = require(path.join(packages, folder, "package.json"));
}
