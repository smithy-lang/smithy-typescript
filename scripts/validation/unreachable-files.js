#!/usr/bin/env node

/**
 * For every .js file in dist-cjs and dist-es, validates that it is reachable
 * from the package's declared entry points via BFS over AST-extracted imports.
 *
 * Usage: node unreachable-files.js <packageDir> [...]
 */

const fs = require("node:fs");
const path = require("node:path");
const walk = require("../utils/walk");
const { extractImports, resolveRelative, getPackageDirs, summarizePackages } = require("./validation-shared");

/**
 * @param code - JS file contents.
 * @returns only the relative specifiers.
 */
function extractRelativeImports(code) {
  return extractImports(code).filter((s) => s.startsWith("."));
}

/**
 * BFS from entry points, following relative imports.
 *
 * @param entryPoints - absolute paths to start from.
 * @returns set of all reachable absolute file paths.
 */
function collectReachable(entryPoints) {
  const visited = new Set();
  const queue = [...entryPoints];

  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file) || !fs.existsSync(file)) {
      continue;
    }
    visited.add(file);

    const code = fs.readFileSync(file, "utf-8");
    for (const specifier of extractRelativeImports(code)) {
      const target = resolveRelative(file, specifier);
      if (target && !visited.has(target)) {
        queue.push(target);
      }
    }
  }
  return visited;
}

/**
 * Collects entry point paths for a dist directory from package.json fields:
 * main, module, exports, browser, react-native.
 *
 * @param pkgJson - parsed package.json.
 * @param packageDir - package root.
 * @param distName - "dist-cjs" or "dist-es".
 * @returns deduplicated absolute paths.
 */
function getEntryPoints(pkgJson, packageDir, distName) {
  const entries = [];

  if (distName === "dist-cjs" && pkgJson.main) {
    entries.push(path.resolve(packageDir, pkgJson.main));
  }
  if (distName === "dist-es" && pkgJson.module) {
    entries.push(path.resolve(packageDir, pkgJson.module));
  }

  if (pkgJson.exports) {
    for (const config of Object.values(pkgJson.exports)) {
      if (typeof config === "string") {
        if (config.includes(distName)) {
          entries.push(path.resolve(packageDir, config));
        }
      } else if (typeof config === "object" && config !== null) {
        for (const val of Object.values(config)) {
          if (typeof val === "string" && val.includes(distName)) {
            entries.push(path.resolve(packageDir, val));
          } else if (typeof val === "object" && val !== null) {
            for (const v of Object.values(val)) {
              if (typeof v === "string" && v.includes(distName)) {
                entries.push(path.resolve(packageDir, v));
              }
            }
          }
        }
      }
    }
  }

  // Browser and react-native replacement targets are also entry points.
  for (const field of ["browser", "react-native"]) {
    const mapping = pkgJson[field];
    if (typeof mapping === "object" && mapping !== null) {
      for (const target of Object.values(mapping)) {
        if (typeof target === "string" && target.includes(distName)) {
          entries.push(path.resolve(packageDir, target.endsWith(".js") ? target : target + ".js"));
        }
      }
    } else if (typeof mapping === "string" && mapping.includes(distName)) {
      entries.push(path.resolve(packageDir, mapping));
    }
  }

  return [...new Set(entries)];
}

/**
 * @param packageDir - package root.
 * @param pkgJson - parsed package.json.
 * @param distName - "dist-cjs" or "dist-es".
 * @returns relative paths of unreachable files.
 */
async function validateDist(packageDir, pkgJson, distName) {
  const distDir = path.join(packageDir, distName);
  if (!fs.existsSync(distDir)) {
    return [];
  }

  const entryPoints = getEntryPoints(pkgJson, packageDir, distName);
  if (!entryPoints.length) {
    return [];
  }

  const reachable = collectReachable(entryPoints);

  const allFiles = [];
  for await (const file of walk(distDir, ["node_modules"])) {
    if (!file.endsWith(".js")) {
      continue;
    }
    // Type-only files compile to just "export {};".
    const content = fs.readFileSync(file, "utf-8").trim();
    if (content === "export {};" || content === "export{};" || content === '"use strict";') {
      continue;
    }
    allFiles.push(file);
  }

  return allFiles.filter((f) => !reachable.has(f)).map((f) => path.relative(packageDir, f));
}

/**
 * @param packageDir - package root.
 * @returns formatted warning messages, or null if skipped.
 */
async function validate(packageDir) {
  const pkgJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    return null;
  }
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  const errors = [];
  for (const dist of ["dist-cjs", "dist-es"]) {
    const unreachable = await validateDist(packageDir, pkgJson, dist);
    errors.push(...unreachable.map((f) => `[${pkgJson.name}] unreachable file: ${f}`));
  }
  return errors;
}

async function main() {
  // Known unreachable files confirmed not erroneous. New additions will cause an error.
  const KNOWN_UNREACHABLE = new Set([
    "[@smithy/core] dist-es/submodules/cbor/byte-printer.js",
    "[@smithy/core] dist-es/submodules/endpoints/util-endpoints/getEndpointUrlConfig.js",
    "[@smithy/core] dist-es/submodules/endpoints/util-endpoints/utils/evaluateTreeRule.js",
    "[@smithy/core] dist-es/submodules/endpoints/util-endpoints/utils/getEndpointProperty.js",
    "[@smithy/core] dist-es/submodules/retry/middleware-retry/longPollMiddleware.js",
    "[interceptor-example-ssdk] dist-cjs/endpoint/EndpointParameters.js",
    "[interceptor-example-ssdk] dist-cjs/endpoint/bdd.js",
    "[interceptor-example-ssdk] dist-cjs/endpoint/endpointResolver.js",
    "[interceptor-example-ssdk] dist-es/endpoint/EndpointParameters.js",
    "[interceptor-example-ssdk] dist-es/endpoint/bdd.js",
    "[interceptor-example-ssdk] dist-es/endpoint/endpointResolver.js",
    "[xyz] dist-cjs/extensionConfiguration.js",
    "[xyz] dist-cjs/runtimeConfig.browser.js",
    "[xyz] dist-cjs/runtimeConfig.native.js",
    "[xyz-schema] dist-cjs/extensionConfiguration.js",
    "[xyz-schema] dist-cjs/runtimeConfig.browser.js",
    "[xyz-schema] dist-cjs/runtimeConfig.native.js",
    "[@smithy/smithy-rpcv2-cbor] dist-cjs/extensionConfiguration.js",
    "[@smithy/smithy-rpcv2-cbor] dist-cjs/runtimeConfig.browser.js",
    "[@smithy/smithy-rpcv2-cbor] dist-cjs/runtimeConfig.native.js",
    "[@smithy/smithy-rpcv2-cbor-schema] dist-cjs/extensionConfiguration.js",
    "[@smithy/smithy-rpcv2-cbor-schema] dist-cjs/runtimeConfig.browser.js",
    "[@smithy/smithy-rpcv2-cbor-schema] dist-cjs/runtimeConfig.native.js",
  ]);

  const packages = getPackageDirs();
  const validated = [];
  const errors = [];
  for (const pkg of packages) {
    const pkgErrors = await validate(pkg.dir);
    if (pkgErrors !== null) {
      validated.push(pkg);
      errors.push(...pkgErrors);
    }
  }

  const knownErrors = errors.filter((e) => {
    const key = e.replace(/unreachable file: /, "");
    return KNOWN_UNREACHABLE.has(key);
  });
  const newErrors = errors.filter((e) => {
    const key = e.replace(/unreachable file: /, "");
    return !KNOWN_UNREACHABLE.has(key);
  });

  if (newErrors.length) {
    console.error(`\n❌ ${newErrors.length} NEW unreachable file(s):\n  ${newErrors.join("\n  ")}`);
    process.exit(1);
  }
  if (!errors.length) {
    console.log(`✅ All dist files are reachable from entry points. (${summarizePackages(validated)})`);
  }
}

main();
