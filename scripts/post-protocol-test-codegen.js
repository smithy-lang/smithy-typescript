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

const isWorkspaceDep = (dep) => dep.startsWith("@smithy/") || dep.startsWith("@aws-smithy/");

for (const dir of privatePackages) {
  const pkgJsonPath = path.join(private, dir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = require(pkgJsonPath);
    for (const dep in pkgJson.dependencies ?? {}) {
      if (isWorkspaceDep(dep)) {
        pkgJson.dependencies[dep] = "workspace:^";
      }
    }
    for (const dep in pkgJson.devDependencies ?? {}) {
      if (isWorkspaceDep(dep)) {
        pkgJson.devDependencies[dep] = "workspace:^";
      }
    }
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
  }
}
