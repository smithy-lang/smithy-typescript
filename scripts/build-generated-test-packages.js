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

// Build types-only package to verify types-mode output compiles
const typesExampleDir = path.join(codegenTestDir, "types-example", "typescript-codegen");

const nodeModulesDir = path.join(root, "node_modules");

const smithyPackages = path.join(root, "packages");

/**
 * Map of package name to its directory, for every package that lives in this
 * repository. Codegen writes the local workspace versions into the generated
 * `package.json`, so these are the dependencies that cannot be resolved from
 * npm on a release PR, where the bumped versions are not published yet.
 *
 * @returns {Map<string, string>} package name to absolute package directory.
 */
const getLocalPackageDirs = () => {
  const localPackageDirs = new Map();
  for (const packagesDir of [smithyPackages]) {
    for (const entry of fs.readdirSync(packagesDir)) {
      const packageDir = path.join(packagesDir, entry);
      const packageJsonPath = path.join(packageDir, "package.json");
      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }
      const { name } = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      if (name) {
        localPackageDirs.set(name, packageDir);
      }
    }
  }
  return localPackageDirs;
};

const localPackageDirs = getLocalPackageDirs();

/**
 * Rewrites the generated dependencies that are published from this repository to
 * point at the local copy via yarn's `link:` protocol, so the install uses the
 * local artifacts instead of resolving from npm. Without this, the install fails
 * on release PRs, because codegen writes the not-yet-published versions into the
 * generated `package.json`.
 *
 * `link:` symlinks the folder without installing its own dependencies, which is
 * what we want here: the local packages declare their dependencies as
 * `workspace:^`, which cannot be resolved outside of this repository's
 * workspaces. Their transitive dependencies resolve through the top-level
 * `node_modules` instead.
 *
 * @param {string} codegenDir - directory of the generated package.
 * @returns {Set<string>} directories of the packages that were linked.
 */
const linkLocalDependencies = (codegenDir) => {
  const packageJsonPath = path.join(codegenDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const linkedPackageDirs = new Set();

  for (const dependencyType of ["dependencies", "devDependencies"]) {
    const dependencies = packageJson[dependencyType];
    if (!dependencies) {
      continue;
    }
    for (const dependency of Object.keys(dependencies)) {
      const localPackageDir = localPackageDirs.get(dependency);
      if (!localPackageDir) {
        continue;
      }
      dependencies[dependency] = `link:${path.relative(codegenDir, localPackageDir)}`;
      linkedPackageDirs.add(localPackageDir);
    }
  }

  if (linkedPackageDirs.size > 0) {
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  return linkedPackageDirs;
};

const buildAndCopyToNodeModules = async (packageName, codegenDir, nodeModulesDir) => {
  try {
    console.log(`Building and copying package \`${packageName}\` in \`${codegenDir}\` to \`${nodeModulesDir}\``);
    // Yarn detects that the generated TypeScript package is nested beneath the
    // top-level package.json. Adding an empty lock file allows it to be treated
    // as its own package.
    await spawnProcess("touch", ["yarn.lock"], { cwd: codegenDir });

    const linkedPackageDirs = linkLocalDependencies(codegenDir);

    await spawnProcess("yarn", { cwd: codegenDir });
    const node_modules = path.join(codegenDir, "node_modules");
    const localSmithyPkgs = fs.readdirSync(smithyPackages);

    // Copy the local build artifacts of the packages that were not linked above,
    // so that transitive dependencies of the linked packages are available.
    // Linked packages are skipped, because their node_modules entry is a symlink
    // back into `packages/`, so copying into it would write to the source.
    for (const smithyPkg of localSmithyPkgs) {
      const localPackageDir = path.join(smithyPackages, smithyPkg);
      if (!fs.existsSync(path.join(localPackageDir, "dist-cjs"))) {
        continue;
      }
      if (linkedPackageDirs.has(localPackageDir)) {
        continue;
      }
      // Ensure the destination directory exists up front. Without this, the parallel
      // `cp -r` calls below race to create the same target directory, and `cp` on some
      // platforms fails with EEXIST when more than one of them tries to create it first.
      await spawnProcess("mkdir", ["-p", path.join(node_modules, "@smithy", smithyPkg)]);
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
  await buildAndCopyToNodeModules("@smithy/types-example", typesExampleDir, nodeModulesDir);

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
