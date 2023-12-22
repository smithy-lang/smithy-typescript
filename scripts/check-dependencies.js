/**
 * Checks devDependency declarations for runtime packages.
 * They should be moved to the dependencies section even if only imported for types.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packages = path.join(root, "packages");
const walk = require("./utils/walk");
const pkgJsonEnforcement = require("./package-json-enforcement");

(async () => {
  const errors = [];
  for (const folder of fs.readdirSync(packages)) {
    const pkgJsonPath = path.join(packages, folder, "package.json");
    errors.push(...pkgJsonEnforcement(pkgJsonPath, true));
    const srcPath = path.join(packages, folder, "src");
    const pkgJson = require(pkgJsonPath);

    for await (const file of walk(srcPath, ["node_modules"])) {
      const contents = fs.readFileSync(file);

      if (file.endsWith(".spec.ts")) {
        continue;
      }

      if (!file.endsWith(".ts")) {
        continue;
      }

      const importedDependencies = [];
      importedDependencies.push(
        ...new Set(
          [...(contents.toString().match(/from "(@(aws-sdk|smithy)\/.*?)"/g) || [])]
            .slice(1)
            .map((_) => _.replace(/from "/g, "").replace(/"$/, ""))
        )
      );

      for (const dependency of importedDependencies) {
        if (!(dependency in pkgJson.dependencies) && dependency !== pkgJson.name) {
          errors.push(`${dependency} undeclared but imported in ${pkgJson.name} ${file}}`);
        }
      }

      for (const [dep, version] of Object.entries(pkgJson.devDependencies ?? {})) {
        if (dep.startsWith("@smithy/") && contents.includes(`from "${dep}";`)) {
          console.warn(`${dep} incorrectly declared in devDependencies of ${folder}`);
          delete pkgJson.devDependencies[dep];
          if (!pkgJson.dependencies) {
            pkgJson.dependencies = {};
          }
          pkgJson.dependencies[dep] = version;

          fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
        }
      }
    }
  }
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
})();
