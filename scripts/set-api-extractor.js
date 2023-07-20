const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packages = path.join(root, "packages");

for (const folder of fs.readdirSync(packages)) {
  if (!['types'].includes(folder)) {
    continue;
  }

  const pkgJson = require(path.join(packages, folder, "package.json"));
  pkgJson.scripts["extract:docs"] = "api-extractor run --local";
  fs.writeFileSync(path.join(packages, folder, "package.json"), JSON.stringify(pkgJson, null, 2), "utf-8");

  fs.writeFileSync(
    path.join(packages, folder, "api-extractor.json"),
    JSON.stringify(
      {
        extends: "../../api-extractor.packages.json",
        mainEntryPointFilePath: "./dist-types/index.d.ts",
      },
      null,
      2
    ),
    "utf-8"
  );
}
