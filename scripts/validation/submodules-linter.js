const fs = require("node:fs");
const path = require("node:path");
const walk = require("../utils/walk");

const singlePkg =
  process.argv.indexOf("--pkg") !== -1 ? process.argv[process.argv.indexOf("--pkg") + 1] : path.basename(process.cwd());

const submodulePackages = process.argv.includes("--all")
  ? fs.readdirSync(path.join(__dirname, "..", "..", "packages")).filter((pkg) => {
      const dir = path.join(__dirname, "..", "..", "packages", pkg);
      if (!fs.existsSync(path.join(dir, "package.json"))) return false;
      return (
        fs.existsSync(path.join(dir, "src", "submodules")) &&
        "exports" in JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"))
      );
    })
  : [singlePkg];

(async () => {
  const errors = [];
  for (const submodulePackage of submodulePackages) {
    const root = path.join(__dirname, "..", "..", "packages", submodulePackage);

    const pkgJson = require(path.join(root, "package.json"));
    if (!pkgJson.exports) {
      pkgJson.exports = {};
    }
    const tsconfigs = {
      cjs: require(path.join(root, "tsconfig.cjs.json")),
      es: require(path.join(root, "tsconfig.es.json")),
      types: require(path.join(root, "tsconfig.types.json")),
    };
    const submodules = fs.readdirSync(path.join(root, "src", "submodules"));

    for (const submodule of submodules) {
      const submodulePath = path.join(root, "src", "submodules", submodule);
      if (fs.existsSync(submodulePath) && fs.lstatSync(submodulePath).isDirectory()) {
        // package.json metadata.
        const pushPkgJson = () => {
          fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(pkgJson, null, 2) + "\n");
        };

        if (!pkgJson.exports[`./${submodule}`]) {
          errors.push(`${submodule} submodule is missing exports statement in package.json`);
          pkgJson.exports[`./${submodule}`] = {
            types: `./dist-types/submodules/${submodule}/index.d.ts`,
            module: `./dist-es/submodules/${submodule}/index.js`,
            node: `./dist-cjs/submodules/${submodule}/index.js`,
            import: `./dist-es/submodules/${submodule}/index.js`,
            require: `./dist-cjs/submodules/${submodule}/index.js`,
          };
          pushPkgJson();
        }
        if (!pkgJson.files.includes(`./${submodule}.js`) || !pkgJson.files.includes(`./${submodule}.d.ts`)) {
          pkgJson.files.push(`./${submodule}.js`);
          pkgJson.files.push(`./${submodule}.d.ts`);
          errors.push(`package.json files array missing ${submodule}.js compatibility redirect file.`);
          pkgJson.files = [...new Set(pkgJson.files)].sort();
          pushPkgJson();
        }

        // typesVersions metadata for downlevel (TypeScript <4.5) resolution.
        const expectedTypesVersion = `dist-types/ts3.4/submodules/${submodule}/index.d.ts`;
        pkgJson.typesVersions = pkgJson.typesVersions ?? {};
        pkgJson.typesVersions["<4.5"] = pkgJson.typesVersions["<4.5"] ?? {
          "dist-types/*": ["dist-types/ts3.4/*"],
        };

        const submoduleTypesVersion = pkgJson.typesVersions["<4.5"][submodule];
        if (
          !Array.isArray(submoduleTypesVersion) ||
          submoduleTypesVersion.length !== 1 ||
          submoduleTypesVersion[0] !== expectedTypesVersion
        ) {
          errors.push(`${submodule} submodule is missing typesVersions entry in package.json`);
          pkgJson.typesVersions["<4.5"][submodule] = [expectedTypesVersion];
          pushPkgJson();
        }

        // tsconfig metadata.
        for (const [kind, tsconfig] of Object.entries(tsconfigs)) {
          if (!tsconfig.compilerOptions?.paths?.[`@smithy/${submodulePackage}/${submodule}`]) {
            errors.push(`${submodule} submodule is missing paths entry in tsconfig.${kind}.json`);
            tsconfig.compilerOptions = tsconfig.compilerOptions ?? {};
            tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths ?? {};

            tsconfig.compilerOptions.paths[`@smithy/${submodulePackage}/${submodule}`] = [
              `./src/submodules/${submodule}/index.ts`,
            ];
            fs.writeFileSync(path.join(root, `tsconfig.${kind}.json`), JSON.stringify(tsconfig, null, 2) + "\n");
          }
        }
        // compatibility redirect file.
        const compatibilityRedirectFile = path.join(root, `${submodule}.js`);
        if (!fs.existsSync(compatibilityRedirectFile)) {
          errors.push(`${submodule} is missing compatibility redirect file in the package root folder.`);
        }
        fs.writeFileSync(
          compatibilityRedirectFile,
          `/**\n * Do not edit:\n * This is a compatibility redirect for contexts that do not understand package.json exports field.\n */\nmodule.exports = require("./dist-cjs/submodules/${submodule}/index.js");\n`
        );
        // compatibility types file.
        const compatibilityTypesFile = path.join(root, `${submodule}.d.ts`);
        if (!fs.existsSync(compatibilityTypesFile)) {
          errors.push(`${submodule} is missing compatibility types file in the package root folder.`);
        }
        fs.writeFileSync(
          compatibilityTypesFile,
          `/**\n * Do not edit:\n * This is a compatibility redirect for contexts that do not understand package.json exports field.\n */\nexport * from "./dist-types/submodules/${submodule}/index";\n`
        );
      }
    }

    /**
     * Root index.ts must not use relative imports — use canonical submodule paths instead.
     * Relative imports bypass conditional exports (browser/react-native resolution).
     */
    const rootIndex = path.join(root, "src", "index.ts");
    if (fs.existsSync(rootIndex)) {
      const rootSource = fs.readFileSync(rootIndex, "utf-8");
      const relImports = (rootSource.match(/from "(\.\.\/?[^"]+)"/g) || []).map((m) => m.match(/"([^"]+)"/)[1]);
      for (const rel of relImports) {
        errors.push(
          `${submodulePackage}/src/index.ts has relative import "${rel}". ` +
            `Use canonical submodule path (e.g. @smithy/${submodulePackage}/submodule) instead.`
        );
      }
    }

    /**
     * If root index uses canonical submodule imports (no src/index.browser.ts),
     * the react-native field should not map root index to a browser variant.
     */
    if (pkgJson["react-native"] && !fs.existsSync(path.join(root, "src", "index.browser.ts"))) {
      let changed = false;
      for (const key of Object.keys(pkgJson["react-native"])) {
        if (key.match(/\.\/dist-(es|cjs)\/index(\.js)?$/)) {
          delete pkgJson["react-native"][key];
          changed = true;
        }
      }
      if (changed) {
        errors.push(`react-native field has stale root index mapping without src/index.browser.ts`);
        fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(pkgJson, null, 2) + "\n");
      }
    }

    /**
     * Check that submodules with .browser.ts or .native.ts files have corresponding index variant files.
     */
    for (const submodule of submodules) {
      const submodulePath = path.join(root, "src", "submodules", submodule);
      if (!fs.existsSync(submodulePath) || !fs.lstatSync(submodulePath).isDirectory()) {
        continue;
      }

      let hasBrowserVariant = false;
      let hasNativeVariant = false;

      const scanDir = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            scanDir(path.join(dir, entry.name));
          } else if (!entry.name.includes(".spec.") && !entry.name.includes(".integ.")) {
            if (entry.name.endsWith(".browser.ts")) hasBrowserVariant = true;
            if (entry.name.endsWith(".native.ts")) hasNativeVariant = true;
          }
        }
      };
      scanDir(submodulePath);

      if (hasBrowserVariant && !fs.existsSync(path.join(submodulePath, "index.browser.ts"))) {
        errors.push(`${submodule} has .browser.ts variant files but is missing index.browser.ts`);
      }
      if (hasNativeVariant && !fs.existsSync(path.join(submodulePath, "index.native.ts"))) {
        errors.push(`${submodule} has .native.ts variant files but is missing index.native.ts`);
      }
    }

    /**
     * Check for cross-submodule relative imports.
     */

    for await (const item of walk(path.join(root, "src", "submodules"))) {
      // depth within the submodule where 1 is at the root of the submodule.
      const depth = item.split(`${submodulePackage}/src/submodules/`)[1].split("/").length - 1;
      const sourceCode = fs.readFileSync(item, "utf-8");

      const relativeImports = [];
      relativeImports.push(
        ...new Set(
          [...(sourceCode.toString().match(/(from |import\()"(.*?)";/g) || [])]
            .map((_) => _.replace(/from "/g, "").replace(/";$/, ""))
            .filter((_) => _.startsWith("."))
        )
      );

      for (const i of relativeImports) {
        const relativeImportDepth = i.split("..").length - 1;
        if (relativeImportDepth >= depth) {
          errors.push(
            `relative import ${i} in ${item
              .split("packages/")
              .pop()} crosses submodule boundaries. Use @scope/package/submodule import instead.`
          );
        }
      }

      const subModuleImports = [
        ...new Set(
          (sourceCode.toString().match(/(from |import\()"@smithy\/[^/"]+\/(.*?)";/g) || [])
            .map((_) => _.match(/@smithy\/[^/"]+\/(.*?)"/)?.[1])
            .filter(Boolean)
        ),
      ];
      const ownModule = item.match(/src\/submodules\/(.*?)\//)?.[1];

      if (subModuleImports.includes(ownModule)) {
        errors.push(`self-referencing submodule import found in ${item}`);
      }
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
})();
