// Bumps the prerelease number of the @aws-smithy/* SSDK packages (e.g.
// 1.0.0-alpha.10 -> 1.0.0-alpha.11). These packages are intentionally kept out
// of the changesets flow (they are listed under "ignore" in
// .changeset/config.json) so that the GA @smithy/* release process is never
// affected. This script is the dedicated version step for the SSDK release.
const fs = require("fs");
const path = require("path");

const SSDK_DIR = path.join(__dirname, "..", "smithy-typescript-ssdk-libs");

const ALPHA_RE = /^(\d+\.\d+\.\d+)-alpha\.(\d+)$/;

function bumpFile(pkgJsonPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const match = ALPHA_RE.exec(pkg.version);
  if (!match) {
    throw new Error(
      `${pkg.name} version "${pkg.version}" is not in the expected x.y.z-alpha.N form`
    );
  }
  const [, base, n] = match;
  const next = `${base}-alpha.${Number(n) + 1}`;
  pkg.version = next;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");
  return { name: pkg.name, version: next };
}

const dirs = fs
  .readdirSync(SSDK_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(SSDK_DIR, d.name, "package.json"))
  .filter((p) => fs.existsSync(p));

const bumped = dirs.map(bumpFile);
for (const { name, version } of bumped) {
  console.log(`bumped ${name} -> ${version}`);
}
