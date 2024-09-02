/**
 *
 * This script builds the generated weather and weather-ssdk test packages
 * and copies them into node_modules for use by integration tests.
 */

const path = require("node:path");
const fs = require("node:fs");

const { spawnProcess } = require("./utils/spawn-process");

const root = path.join(__dirname, "..");

const testProjectDir = path.join(root, "smithy-typescript-codegen-test");

const codegenTestDir = path.join(testProjectDir, "build", "smithyprojections", "smithy-typescript-codegen-test");

const weatherClientDir = path.join(codegenTestDir, "source", "typescript-client-codegen");

// Build generic legacy auth client for integration tests
const weatherLegacyAuthClientDir = path.join(codegenTestDir, "client-legacy-auth", "typescript-client-codegen");

const weatherSsdkDir = path.join(codegenTestDir, "ssdk-test", "typescript-server-codegen");

// Build `@httpApiKeyAuth` client for integration tests
const httpApiKeyAuthClientDir = path.join(
  codegenTestDir,
  "identity-and-auth-http-api-key-auth",
  "typescript-client-codegen"
);

// Build `@httpBearerAuth` client for integration tests
const httpBearerAuthClientDir = path.join(
  codegenTestDir,
  "identity-and-auth-http-bearer-auth",
  "typescript-client-codegen"
);

const nodeModulesDir = path.join(root, "node_modules");

const buildAndCopyToNodeModules = async (packageName, codegenDir, nodeModulesDir) => {
  try {
    console.log(`Building and copying package \`${packageName}\` in \`${codegenDir}\` to \`${nodeModulesDir}\``);
    // Yarn detects that the generated TypeScript package is nested beneath the
    // top-level package.json. Adding an empty lock file allows it to be treated
    // as its own package.
    await spawnProcess("touch", ["yarn.lock"], { cwd: codegenDir });
    await spawnProcess("yarn", { cwd: codegenDir });
    const smithyPackages = path.join(__dirname, "..", "packages");
    const node_modules = path.join(codegenDir, "node_modules");
    const localSmithyPkgs = fs.readdirSync(smithyPackages);

    for (const smithyPkg of localSmithyPkgs) {
      if (!fs.existsSync(path.join(smithyPackages, smithyPkg, "dist-cjs"))) {
        continue;
      }
      await Promise.all(
        ["dist-cjs", "dist-types", "dist-es", "package.json"].map((folder) =>
          spawnProcess("cp", [
            "-r",
            path.join(smithyPackages, smithyPkg, folder),
            path.join(node_modules, "@smithy", smithyPkg),
          ])
        )
      );
    }

    await spawnProcess("yarn", ["build"], { cwd: codegenDir });

    // Optionally, after building the package, it's packed and copied to node_modules so that
    // it can be used in integration tests by other packages within the monorepo.
    if (nodeModulesDir != undefined) {
      await spawnProcess("yarn", ["pack"], { cwd: codegenDir });
      await spawnProcess("rm", ["-rf", packageName], { cwd: nodeModulesDir });
      await spawnProcess("mkdir", ["-p", packageName], { cwd: nodeModulesDir });
      const targetPackageDir = path.join(nodeModulesDir, packageName);
      await spawnProcess("tar", ["-xf", "package.tgz", "-C", targetPackageDir, "--strip-components", "1"], {
        cwd: codegenDir,
      });
    }
  } catch (e) {
    console.log(
      `Building and copying package \`${packageName}\` in \`${codegenDir}\` to \`${nodeModulesDir}\` failed:`
    );
    console.log(e);
    process.exit(1);
  }
};

(async () => {
  await buildAndCopyToNodeModules("weather", weatherClientDir, nodeModulesDir);
  await buildAndCopyToNodeModules("weather-ssdk", weatherSsdkDir, nodeModulesDir);
  await buildAndCopyToNodeModules("@smithy/weather-legacy-auth", weatherLegacyAuthClientDir, nodeModulesDir);
  await buildAndCopyToNodeModules(
    "@smithy/identity-and-auth-http-api-key-auth-service",
    httpApiKeyAuthClientDir,
    nodeModulesDir
  );
  await buildAndCopyToNodeModules(
    "@smithy/identity-and-auth-http-bearer-auth-service",
    httpBearerAuthClientDir,
    nodeModulesDir
  );

  // TODO(released-version-test): Test released version of smithy-typescript codegenerators, but currently is not working
  /*
  const releasedClientDir = path.join(
    testProjectDir,
    "released-version-test",
    "build",
    "smithyprojections",
    "released-version-test",
    "source",
    "typescript-codegen"
  );
  */
  // await buildAndCopyToNodeModules("released", releasedClientDir, undefined);
})();
