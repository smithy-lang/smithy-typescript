/**
 * Combined ES module transpilation (oxc-transform) + CJS inlining (rollup)
 * for a single package.
 *
 * Usage: node ../../scripts/compilation/es_cjs.js
 *   (run from a package directory)
 *
 * Falls back to tsc + inline on Node < 20 (oxc requires Node >= 20.19).
 */
const path = require("node:path");
const { execSync } = require("node:child_process");

const NODE_MAJOR = parseInt(process.versions.node.split(".")[0], 10);

if (NODE_MAJOR < 20) {
  // Fallback: use tsc and the legacy inline script.
  execSync("premove dist-es && yarn g:tsc -p tsconfig.es.json && node ../../scripts/inline", {
    cwd: process.cwd(),
    stdio: "inherit",
  });
} else {
  const buildEs = require("./build-es");
  const Inliner = require("./Inliner");

  const packageDir = process.cwd();
  const pkg = path.basename(packageDir);

  // Step 1: build-es (oxc-transform src/ -> dist-es/).
  buildEs(packageDir);

  // Step 2: inline (rollup bundle dist-es/ -> dist-cjs/).
  (async () => {
    const inliner = new Inliner(pkg);
    await inliner.clean();
    await inliner.discoverVariants();
    await inliner.bundle();
    await inliner.transformVariants();
    await inliner.fixVariantImportPaths();
    await inliner.validate();
  })();
}
