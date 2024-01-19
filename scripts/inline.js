/**
 *
 * Inline a package as one dist file.
 *
 */

const fs = require("fs");
const path = require("path");
const Inliner = require("./compilation/Inliner");

const root = path.join(__dirname, "..");

const package = process.argv[2];

if (!package) {
  /**
   * If no package is selected, this script sets all build:cjs scripts to
   * use this inliner script instead of only tsc.
   */
  const packages = fs.readdirSync(path.join(root, "packages"));
  for (const pkg of packages) {
    const pkgJsonFilePath = path.join(root, "packages", pkg, "package.json");
    const pkgJson = require(pkgJsonFilePath);

    pkgJson.scripts["build:cjs"] = `node ../../scripts/inline ${pkg}`;
    fs.writeFileSync(pkgJsonFilePath, JSON.stringify(pkgJson, null, 2));
  }
} else {
  (async () => {
    const inliner = new Inliner(package);
    await inliner.clean();
    await inliner.tsc();
    await inliner.discoverVariants();
    await inliner.bundle();
    await inliner.rewriteStubs();
    await inliner.fixVariantImportPaths();
    await inliner.dedupeExternals();
    await inliner.annotateCjsExportNames();
    await inliner.validate();
  })();
}
