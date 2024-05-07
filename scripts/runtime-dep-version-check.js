#!/usr/bin/env node

/**
 * This script checks the declared dependencies throughout the entire repo
 * and throws an error if there is are more than one version of a dependency.
 *
 * @example
 * ```
 * There is more than one version of a declared dependency
 * @smithy/middleware-endpoint {
 *   '^1.0.2': '350 locations',
 *   '^1.0.1': [
 *     '@aws-sdk/lib-storage',
 *     '@aws-sdk/middleware-sdk-ec2',
 *     '@aws-sdk/middleware-sdk-rds',
 *     '@aws-sdk/s3-presigned-post',
 *     '@aws-sdk/s3-request-presigner'
 *   ]
 * }
 * ```
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const packages = fs.readdirSync(path.join(root, "packages"));

const nonClientPackages = [...packages.map((p) => path.join(root, "packages", p))];

const deps = {
  /* @namespace/name: {
    [version]: [location, location]
  } */
};

readPackages(nonClientPackages);
checkVersions();

function checkVersions() {
  const errors = [];

  for (const [pkg, versions] of Object.entries(deps)) {
    const versionCount = Object.keys(versions).length;
    if (versionCount > 1) {
      console.error("There is more than one version of a declared dependency.");
      console.error(
        pkg,
        Object.entries(versions).reduce((acc, [version, locations]) => {
          acc[version] = locations.length > 20 ? `${locations.length} locations` : locations;
          return acc;
        }, {})
      );
      errors.push(pkg);
    }
  }

  if (errors.length) {
    const violations = errors.join(", ");
    throw new Error(violations + " have inconsistent declared versions.");
  }
}

function readPackages(packages) {
  for (const pkg of packages) {
    const pkgJson = require(path.join(pkg, "package.json"));
    const { dependencies = {}, devDependencies = {} } = pkgJson;
    for (const [name, version] of Object.entries(dependencies)) {
      if (version.startsWith("file:")) {
        continue;
      }
      deps[name] = deps[name] ?? {};
      deps[name][version] = deps[name][version] ?? [];
      deps[name][version].push(pkgJson.name);
    }

    for (const [name, version] of Object.entries(devDependencies)) {
      if (version.startsWith("file:")) {
        continue;
      }
      deps[name] = deps[name] ?? {};
      deps[name][version] = deps[name][version] ?? [];
      deps[name][version].push(pkgJson.name);
    }
  }
}
