/**
 *
 * Script to be run after protocol test codegen to set the smithy dependencies
 * to workspace:^
 *
 */

const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");

const private = path.join(root, "private");

const privatePackages = fs.readdirSync(private);

for (const dir of privatePackages) {
  const pkgJsonPath = path.join(private, dir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = require(pkgJsonPath);
    for (const dep in pkgJson.dependencies ?? {}) {
      if (dep.startsWith("@smithy/")) {
        pkgJson.dependencies[dep] = "workspace:^";
      }
    }
    for (const dep in pkgJson.devDependencies ?? {}) {
      if (dep.startsWith("@smithy/")) {
        pkgJson.dependencies[dep] = "workspace:^";
      }
    }
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
  }
}
