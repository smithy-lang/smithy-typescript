/**
 *
 * Script to be run after protocol test codegen to set the smithy dependencies
 * to workspace:^ and to drop declared dependencies that the generated source
 * never imports.
 *
 */

const path = require("node:path");
const fs = require("node:fs");

const { getPackageName } = require("./validation/validation-shared");

const root = path.join(__dirname, "..");

const private = path.join(root, "private");

const privatePackages = fs.readdirSync(private);

const isWorkspaceDep = (dep) => dep.startsWith("@smithy/");

// Dependencies the deps-used validation always treats as used.
const IMPLICIT_DEPS = new Set(["tslib"]);
const IMPORT_RE = /from\s+["']([^"']+)["']/g;

const collectImportedPackages = (dir) => {
  const imported = new Set();
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") {
          visit(full);
        }
      } else if (entry.name.endsWith(".ts")) {
        const code = fs.readFileSync(full, "utf-8");
        let match;
        IMPORT_RE.lastIndex = 0;
        while ((match = IMPORT_RE.exec(code)) !== null) {
          const specifier = match[1];
          if (specifier.startsWith(".") || specifier.startsWith("node:")) {
            continue;
          }
          imported.add(getPackageName(specifier));
        }
      }
    }
  };
  const srcDir = path.join(dir, "src");
  if (fs.existsSync(srcDir)) {
    visit(srcDir);
  }
  return imported;
};

for (const dir of privatePackages) {
  const packageDir = path.join(private, dir);
  const pkgJsonPath = path.join(packageDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = require(pkgJsonPath);
    const imported = collectImportedPackages(packageDir);
    for (const dep in pkgJson.dependencies ?? {}) {
      if (!IMPLICIT_DEPS.has(dep) && !imported.has(dep)) {
        delete pkgJson.dependencies[dep];
        continue;
      }
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
