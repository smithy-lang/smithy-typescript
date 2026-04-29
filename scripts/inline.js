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

    delete pkgJson.scripts["build:cjs"];
    delete pkgJson.scripts["build:es"];
    pkgJson.scripts["build:es:cjs"] = `yarn g:tsc -p tsconfig.es.json && node ../../scripts/inline ${pkg}`;
    pkgJson.scripts.build = `concurrently 'yarn:build:types' 'yarn:build:es:cjs'`;

    const scripts = {};
    const keys = Object.keys(pkgJson.scripts);
    for (const key of keys.sort()) {
      scripts[key] = pkgJson.scripts[key];
    }
    pkgJson.scripts = scripts;

    fs.writeFileSync(pkgJsonFilePath, JSON.stringify(pkgJson, null, 2));
  }
} else {
  (async () => {
    const inliner = new Inliner(package);
    await inliner.clean();
    await inliner.tsc();
    await inliner.discoverVariants();
    await inliner.bundle();
    await inliner.cleanupInlinedFiles();
    await inliner.fixVariantImportPaths();
    await inliner.validate();
  })();
}
