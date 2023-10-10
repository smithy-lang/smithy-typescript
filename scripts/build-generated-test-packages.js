/**
 *
 * This script builds the generated weather and weather-ssdk test packages
 * and copies them into node_modules for use by integration tests.
 */

const path = require("node:path");
const { spawnProcess } = require("./utils/spawn-process");

const root = path.join(__dirname, "..");

const codegenTestDir = path.join(
    root,
    "smithy-typescript-codegen-test",
    "build",
    "smithyprojections",
    "smithy-typescript-codegen-test",
);

const weatherClientDir = path.join(
    codegenTestDir,
    "source",
    "typescript-codegen"
);

const weatherSsdkDir = path.join(
    codegenTestDir,
    "ssdk-test",
    "typescript-ssdk-codegen"
)

const nodeModulesDir = path.join(root, "node_modules");

const buildAndCopyToNodeModules = async (packageName, codegenDir, nodeModulesDir) => {
    console.log(`Building and copying package \`${packageName}\` in \`${codegenDir}\` to \`${nodeModulesDir}\``);
    // Yarn detects that the generated TypeScript package is nested beneath the
    // top-level package.json. Adding an empty lock file allows it to be treated
    // as its own package.
    await spawnProcess("touch", ["yarn.lock"], { cwd: codegenDir });
    await spawnProcess("yarn", { cwd: codegenDir });
    await spawnProcess("yarn", ["build"], { cwd: codegenDir });
    // After building the package, its packed and copied to node_modules so that
    // it can be used in integration tests by other packages within the monorepo.
    await spawnProcess("yarn", ["pack"], { cwd: codegenDir });
    await spawnProcess("rm", ["-rf", packageName], { cwd: nodeModulesDir });
    await spawnProcess("mkdir", ["-p", packageName], { cwd: nodeModulesDir });
    const targetPackageDir = path.join(nodeModulesDir, packageName);
    await spawnProcess("tar", ["-xf", "package.tgz", "-C", targetPackageDir, "--strip-components", "1"], { cwd: codegenDir });
};

(async () => {
  try {
    await buildAndCopyToNodeModules("weather", weatherClientDir, nodeModulesDir);
    await buildAndCopyToNodeModules("weather-ssdk", weatherSsdkDir, nodeModulesDir);
 } catch (e) {
    console.log(e);
    process.exit(1);
 }
})();
