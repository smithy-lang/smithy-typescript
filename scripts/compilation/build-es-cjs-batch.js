/**
 * Batch build:es:cjs — transpiles ES modules (oxc-transform) then inlines to dist-cjs
 * for multiple packages in a single process.
 *
 * Usage:
 *   node scripts/compilation/build-es-cjs-batch.js core types
 *   node scripts/compilation/build-es-cjs-batch.js --all
 *   node scripts/compilation/build-es-cjs-batch.js --concurrency 4 core types
 */

const path = require("node:path");
const fs = require("node:fs");
const { listFolders } = require("../utils/list-folders");
const buildEs = require("./build-es");
const Inliner = require("./Inliner");

const root = path.join(__dirname, "..", "..");

const args = process.argv.slice(2);
const concurrency = (() => {
  const idx = args.indexOf("--concurrency");
  if (idx !== -1) {
    const val = parseInt(args[idx + 1], 10);
    args.splice(idx, 2);
    return val;
  }
  return 6;
})();

const all = args.includes("--all");
if (all) args.splice(args.indexOf("--all"), 1);

function getAllPackages() {
  const packages = [];
  for (const pkg of listFolders(path.join(root, "packages"))) {
    const pkgJsonPath = path.join(root, "packages", pkg, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    if (pkgJson.scripts && pkgJson.scripts["build:es:cjs"]) {
      packages.push(pkg);
    }
  }
  return packages;
}

function resolvePackageDir(pkg) {
  const candidates = [path.join(root, "packages", pkg), path.join(root, "private", pkg)];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

async function inline(pkg) {
  const inliner = new Inliner(pkg);
  await inliner.clean();
  await inliner.discoverVariants();
  await inliner.bundle();
  await inliner.transformVariants();
  await inliner.fixVariantImportPaths();
  await inliner.validate();
}

async function runBatch(packages, concurrency) {
  const total = packages.length;
  let completed = 0;
  const start = Date.now();

  async function processPackage(pkg) {
    const t0 = Date.now();
    const packageDir = resolvePackageDir(pkg);
    if (!packageDir) {
      throw new Error(`Package not found: ${pkg}`);
    }
    const fileCount = buildEs(packageDir);
    try {
      await inline(pkg);
    } catch (e) {
      completed++;
      console.log(`[${completed}/${total}] ${pkg} (${fileCount} files, inline SKIPPED: ${e.message.split("\n")[0]}, ${Date.now() - t0}ms)`);
      return;
    }
    completed++;
    console.log(`[${completed}/${total}] ${pkg} (${fileCount} files, ${Date.now() - t0}ms)`);
  }

  // Process with bounded concurrency.
  const queue = [...packages];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const pkg = queue.shift();
      await processPackage(pkg);
    }
  });

  await Promise.all(workers);
  console.log(`\nDone: ${total} packages in ${((Date.now() - start) / 1000).toFixed(1)}s (concurrency=${concurrency})`);
}

const packages = all ? getAllPackages() : args;

if (packages.length === 0) {
  console.error("Usage: node build-es-cjs-batch.js [--concurrency N] [--all] pkg1 pkg2 ...");
  process.exit(1);
}

runBatch(packages, concurrency);
