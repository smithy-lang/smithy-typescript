/**
 *
 * This script rewrites the TypeScriptDepdendency.java file
 * with the current versions present in the packages/__/package.json files.
 *
 * This script can be deleted after moving to an automated method
 * of updating the package version numbers in code generation.
 *
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packages = path.join(root, "packages");

const javaFile = path.join(
  root,
  "smithy-typescript-codegen",
  "src",
  "main",
  "java",
  "software",
  "amazon",
  "smithy",
  "typescript",
  "codegen",
  "TypeScriptDependency.java"
);

let javaSrc = fs.readFileSync(javaFile, "utf-8");

for (const folder of fs.readdirSync(packages)) {
  const pkgJson = require(path.join(packages, folder, "package.json"));
  const { version, name } = pkgJson;

  const find = new RegExp(`"@smithy\\/${name.replace("@smithy/", "")}",(\\s)*"\\^\\d+\\.\\d+\\.\\d+"`);

  const replace = `"${name}", "^${version}"`;

  console.log(find, replace, find.test(javaSrc));

  javaSrc = javaSrc.replace(find, replace);
}

fs.writeFileSync(javaFile, javaSrc, "utf-8");
