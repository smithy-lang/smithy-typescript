const fs = require("node:fs");
const path = require("node:path");

const packages = fs.readdirSync(path.join(__dirname, "..", "packages"));

for (const pkgFolder of packages) {
  const pkgJsonPath = path.join(__dirname, "..", "packages", pkgFolder, "package.json");
  const pkgJson = require(pkgJsonPath);
  pkgJson["engines"] = {
    node: ">=18.0.0",
  };
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
}
