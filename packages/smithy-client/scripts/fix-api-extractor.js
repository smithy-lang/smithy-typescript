const fs = require("node:fs");
const path = require("path");

const file = path.join(__dirname, "..", "dist-types", "index.d.ts");

const contents = fs.readFileSync(file, "utf-8");

/**
 * This build script temporarily excludes the statement
 * ```
 * export * from "@smithy/core/serde";
 * ```
 * from the package's type declarations during running api-extractor.
 *
 * This has no effect on the runtime, but api-extractor at this time cannot understand
 * the package.json exports field nor the compatibility redirect (packages/core/serde.d.ts).
 */

module.exports = {
  source: `export * from "@smithy/core/serde";`,
  replacement: `/* export * from "@smithy/core/serde"; */`,
  unset() {
    fs.writeFileSync(file, contents.replace(module.exports.replacement, module.exports.source));
  },
  set() {
    fs.writeFileSync(file, contents.replace(module.exports.source, module.exports.replacement));
  },
};

if (process.argv.includes("--unset")) {
  module.exports.unset();
} else {
  module.exports.set();
}
