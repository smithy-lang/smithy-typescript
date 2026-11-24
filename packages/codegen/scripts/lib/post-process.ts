import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const IMPLICIT_DEPS = new Set(["tslib"]);
const IMPORT_RE = /from\s+["']([^"']+)["']/g;

const packageNameOf = (specifier: string): string => {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};

const collectImportedPackages = (dir: string): Set<string> => {
  const imported = new Set<string>();
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") {
          visit(full);
        }
      } else if (entry.name.endsWith(".ts")) {
        const code = readFileSync(full, "utf-8");
        for (const match of code.matchAll(IMPORT_RE)) {
          const specifier = match[1];
          if (!specifier.startsWith(".") && !specifier.startsWith("node:")) {
            imported.add(packageNameOf(specifier));
          }
        }
      }
    }
  };
  if (existsSync(join(dir, "src"))) {
    visit(join(dir, "src"));
  }
  return imported;
};

const sortKeys = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** Mirrors scripts/post-protocol-test-codegen.js plus the key sorting yarn applies on install. */
export function postProcessPackage(packageDir: string): void {
  const path = join(packageDir, "package.json");
  if (!existsSync(path)) {
    return;
  }
  const pkg = JSON.parse(readFileSync(path, "utf-8"));
  const imported = collectImportedPackages(packageDir);
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (!IMPLICIT_DEPS.has(dep) && !imported.has(dep)) {
      delete pkg.dependencies[dep];
    } else if (dep.startsWith("@smithy/")) {
      pkg.dependencies[dep] = "workspace:^";
    }
  }
  for (const dep of Object.keys(pkg.devDependencies ?? {})) {
    if (dep.startsWith("@smithy/")) {
      pkg.devDependencies[dep] = "workspace:^";
    }
  }
  if (pkg.dependencies) {
    pkg.dependencies = sortKeys(pkg.dependencies);
  }
  if (pkg.devDependencies) {
    pkg.devDependencies = sortKeys(pkg.devDependencies);
  }
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
}
