const fs = require("node:fs");
const path = require("node:path");
const { spawnProcess } = require("./../utils/spawn-process");
const walk = require("./../utils/walk");
const rollup = require("rollup");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const json = require("@rollup/plugin-json");

const root = path.join(__dirname, "..", "..");

/**
 *
 * Inline a package as one dist file, preserves other files as re-export stubs,
 * preserves files with react-native variants as externals.
 *
 */
module.exports = class Inliner {
  constructor(pkg) {
    this.package = pkg;
    this.platform = "node";
    this.submodulePackages = ["core"];
    this.hasSubmodules = this.submodulePackages.includes(pkg);
    this.subfolder = "packages";
    this.verbose = process.env.DEBUG || process.argv.includes("--debug");

    this.packageDirectory = path.join(root, this.subfolder, pkg);

    this.outfile = path.join(root, this.subfolder, pkg, "dist-cjs", "index.js");

    this.pkgJson = require(path.join(root, this.subfolder, this.package, "package.json"));
    /**
     * If the react entrypoint is another file entirely, then bail out of inlining.
     */
    this.bailout = typeof this.pkgJson["react-native"] === "string";
  }

  /**
   * step 0: delete the dist-cjs folder.
   */
  async clean() {
    await spawnProcess("yarn", ["premove", "./dist-cjs", "tsconfig.cjs.tsbuildinfo"], { cwd: this.packageDirectory });
    if (this.verbose) {
      console.log("Deleted ./dist-cjs in " + this.package);
    }
    return this;
  }

  /**
   * step 1: build the default tsc dist-cjs output with dispersed files.
   * we will need the files to be in place for stubbing.
   */
  async tsc() {
    await spawnProcess("yarn", ["g:tsc", "-p", "tsconfig.cjs.json"], { cwd: this.packageDirectory });
    if (this.verbose) {
      console.log("Finished recompiling ./dist-cjs in " + this.package);
    }
    this.canonicalExports = Object.keys(require(this.outfile));
    return this;
  }

  /**
   * step 2: detect all variant files and their transitive local imports.
   * these files will not be inlined, in order to preserve the react-native dist-cjs file replacement behavior.
   */
  async discoverVariants() {
    if (this.bailout) {
      console.log("Inliner bailout.");
      return this;
    }
    this.variantEntries = Object.entries(this.pkgJson["react-native"] ?? {});

    for await (const file of walk(path.join(this.packageDirectory, "dist-cjs"))) {
      if (file.endsWith(".js") && fs.existsSync(file.replace(/\.js$/, ".native.js"))) {
        console.log("detected undeclared auto-variant", file);
        const canonical = file.replace(/(.*?)dist-cjs\//, "./dist-cjs/").replace(/\.js$/, "");
        const variant = canonical.replace(/(.*?)(\.js)?$/, "$1.native$2");

        this.variantEntries.push([canonical, variant]);
      }
      if (file.endsWith(".js") && !file.endsWith(".browser.js") && fs.existsSync(file.replace(/\.js$/, ".browser.js"))) {
        const canonical = file.replace(/(.*?)dist-cjs\//, "./dist-cjs/").replace(/\.js$/, "");
        const variant = canonical.replace(/(.*?)(\.js)?$/, "$1.browser$2");

        this.variantEntries.push([canonical, variant]);
      }
    }

    this.transitiveVariants = [];

    for (const [k, v] of this.variantEntries) {
      for (const variantFile of [k, String(v)]) {
        if (!variantFile.includes("dist-cjs/")) {
          continue;
        }
        const keyFile = path.join(
          this.packageDirectory,
          "dist-cjs",
          variantFile.replace(/(.*?)dist-cjs\//, "") + (variantFile.endsWith(".js") ? "" : ".js")
        );
        const keyFileContents = fs.readFileSync(keyFile, "utf-8");
        const requireStatements = keyFileContents.matchAll(/require\("(.*?)"\)/g);
        for (const requireStatement of requireStatements) {
          if (requireStatement[1]?.startsWith(".")) {
            // is relative import.
            const key = path
              .normalize(path.join(path.dirname(keyFile), requireStatement[1]))
              .replace(/(.*?)dist-cjs\//, "./dist-cjs/");
            if (this.verbose) {
              console.log("Transitive variant file:", key);
            }

            const transitiveVariant = key.replace(/(.*?)dist-cjs\//, "").replace(/(\.js)?$/, "");

            if (!this.transitiveVariants.includes(transitiveVariant)) {
              this.variantEntries.push([key, key]);
              this.transitiveVariants.push(transitiveVariant);
            }
          }
        }
      }
    }

    this.variantExternals = [];
    this.variantMap = {};

    for (const [k, v] of this.variantEntries) {
      const prefix = "dist-cjs/";
      const keyPrefixIndex = k.indexOf(prefix);
      if (keyPrefixIndex === -1) {
        continue;
      }
      const keyRelativePath = k.slice(keyPrefixIndex + prefix.length);
      const valuePrefixIndex = String(v).indexOf(prefix);

      const addJsExtension = (file) => (file.endsWith(".js") ? file : file + ".js");

      if (valuePrefixIndex !== -1) {
        const valueRelativePath = String(v).slice(valuePrefixIndex + prefix.length);
        this.variantExternals.push(...[keyRelativePath, valueRelativePath].map(addJsExtension));
        this.variantMap[keyRelativePath] = valueRelativePath;
      } else {
        this.variantExternals.push(addJsExtension(keyRelativePath));
        this.variantMap[keyRelativePath] = v;
      }
    }

    this.variantExternals = [...new Set(this.variantExternals)];

    return this;
  }

  /**
   * step 3: bundle the package index into dist-cjs/index.js except for node_modules
   * and also excluding any local files that have variants for react-native.
   */
  async bundle() {
    if (this.bailout) {
      return this;
    }

    const variantExternalsForRollup = this.variantExternals.map((variant) => variant.replace(/.js$/, ""));

    const entryPoint = path.join(root, this.subfolder, this.package, "dist-es", "index.js");

    const externalityAssessments = {};

    const inputOptions = (externals) => ({
      input: [entryPoint],
      plugins: [nodeResolve(), json()],
      onwarn(warning) {
        /*
        Circular imports are not an error in the language spec,
        but reasoning about the program and bundling becomes easier.
        For that reason let's avoid them.
         */
        if (warning.code === "CIRCULAR_DEPENDENCY") {
          throw Error(warning.message);
        }
      },
      external: (id) => {
        if (undefined !== externalityAssessments[id]) {
          return externalityAssessments[id];
        }

        const relative = !!id.match(/^\.?\.?\//);
        if (!relative) {
          if (this.verbose) {
            console.log("EXTERN (pkg)", id);
          }
          return (externalityAssessments[id] = true);
        }

        if (id === entryPoint) {
          if (this.verbose) {
            console.log("INTERN (entry point)", id);
          }
          return (externalityAssessments[id] = false);
        }

        const local =
          id.includes(`/dist-es/`) &&
          ((id.includes(`/packages/`) && !id.includes(`packages/${this.package}/`)) ||
            (id.includes(`/packages-internal/`) && !id.includes(`packages-internal/${this.package}/`)));
        if (local) {
          if (this.verbose) {
            console.log("EXTERN (local)", id);
          }
          return (externalityAssessments[id] = true);
        }

        for (const file of externals) {
          const idWithoutExtension = id.replace(/\.[tj]s$/, "");
          if (idWithoutExtension.endsWith(path.basename(file))) {
            if (this.verbose) {
              console.log("EXTERN (variant)", id);
            }
            return (externalityAssessments[id] = true);
          }
        }

        if (this.verbose) {
          console.log("INTERN (invariant)", id);
        }
        return (externalityAssessments[id] = false);
      },
    });

    const outputOptions = {
      dir: path.dirname(this.outfile),
      format: "cjs",
      exports: "named",
      preserveModules: false,
      externalLiveBindings: false,
    };

    const bundle = await rollup.rollup(inputOptions(variantExternalsForRollup));
    await bundle.write(outputOptions);
    await bundle.close();

    if (this.hasSubmodules) {
      const submodules = fs.readdirSync(path.join(root, this.subfolder, this.package, "src", "submodules"));
      for (const submodule of submodules) {
        if (
          !fs.lstatSync(path.join(root, this.subfolder, this.package, "src", "submodules", submodule)).isDirectory()
        ) {
          continue;
        }

        // remove invariant files.
        for await (const file of walk(
          path.join(root, this.subfolder, this.package, "dist-cjs", "submodules", submodule)
        )) {
          const stat = fs.lstatSync(file);
          if (this.variantExternals.find((ext) => file.endsWith(ext))) {
            continue;
          }
          if (stat.isDirectory()) {
            if (fs.readdirSync(file).length === 0) {
              fs.rmdirSync(file);
            }
          } else {
            fs.rmSync(file);
          }
        }

        // remove remaining empty directories.
        const submoduleFolder = path.join(root, this.subfolder, this.package, "dist-cjs", "submodules", submodule);
        function rmdirEmpty(dir) {
          for (const entry of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, entry);
            if (fs.lstatSync(fullPath).isDirectory()) {
              if (fs.readdirSync(fullPath).length) {
                rmdirEmpty(fullPath);
              } else {
                fs.rmdirSync(fullPath);
              }
            }
          }
        }
        rmdirEmpty(submoduleFolder);

        const submoduleVariants = variantExternalsForRollup.filter((external) =>
          external.includes(`submodules/${submodule}`)
        );

        const submoduleOptions = inputOptions(submoduleVariants);

        const submoduleBundle = await rollup.rollup({
          ...submoduleOptions,
          input: path.join(root, this.subfolder, this.package, "dist-es", "submodules", submodule, "index.js"),
        });

        await submoduleBundle.write({
          ...outputOptions,
          dir: path.dirname(
            path.join(root, this.subfolder, this.package, "dist-cjs", "submodules", submodule, "index.js")
          ),
        });

        await submoduleBundle.close();
      }
    }

    return this;
  }

  /**
   * step 4: delete all existing dist-cjs files except the index.js file
   * and variant externals. These files were inlined into the bundle.
   */
  async cleanupInlinedFiles() {
    if (this.bailout || this.hasSubmodules) {
      return this;
    }

    for await (const file of walk(path.join(this.packageDirectory, "dist-cjs"))) {
      const relativePath = file.replace(path.join(this.packageDirectory, "dist-cjs"), "").slice(1);

      if (relativePath.includes("submodules")) {
        continue;
      }

      if (!file.endsWith(".js")) {
        continue;
      }

      if (relativePath === "index.js") {
        continue;
      }

      if (this.variantExternals.find((external) => relativePath.endsWith(external))) {
        continue;
      }

      if (fs.readFileSync(file, "utf-8").includes(`Object.defineProperty(exports, "__esModule", { value: true });`)) {
        fs.rmSync(file);
      }
      const files = fs.readdirSync(path.dirname(file));
      if (files.length === 0) {
        fs.rmdirSync(path.dirname(file));
      }
    }

    return this;
  }

  /**
   * step 5: rewrite variant external imports to correct path.
   * these externalized variants use relative imports for transitive variant files
   * which need to be rewritten when in the index.js file.
   */
  async fixVariantImportPaths() {
    if (this.bailout) {
      return this;
    }
    this.indexContents = fs.readFileSync(this.outfile, "utf-8");
    const fixImportsForFile = (contents, remove = "") => {
      for (const variant of Object.keys(this.variantMap)) {
        const basename = path.basename(variant).replace(/.js$/, "");
        const dirname = path.dirname(variant);

        const find = new RegExp(`require\\("\\.(.*?)/${basename}"\\)`, "g");
        const replace = `require("./${dirname}/${basename}")`.replace(remove, "");

        contents = contents.replace(find, replace);

        if (this.verbose) {
          console.log("Replacing", find, "with", replace, "removed=", remove);
        }
      }
      return contents;
    };
    if (this.verbose) {
      console.log("Fixing imports for main file", path.dirname(this.outfile));
    }
    this.indexContents = fixImportsForFile(this.indexContents);
    fs.writeFileSync(this.outfile, this.indexContents, "utf-8");
    if (this.hasSubmodules) {
      const submodules = fs.readdirSync(path.join(path.dirname(this.outfile), "submodules"));
      for (const submodule of submodules) {
        const submoduleIndexPath = path.join(path.dirname(this.outfile), "submodules", submodule, "index.js");
        const submoduleIndexContents = fs.readFileSync(submoduleIndexPath, "utf-8");
        if (this.verbose) {
          console.log("Fixing imports for submodule file", path.dirname(submoduleIndexPath));
        }
        fs.writeFileSync(
          submoduleIndexPath,
          fixImportsForFile(submoduleIndexContents, new RegExp(`/submodules/(${submodules.join("|")})`, "g"))
        );
        try {
          require(submoduleIndexPath);
        } catch (e) {
          console.error(`File ${submoduleIndexPath} has import errors.`);
          throw e;
        }
      }
    }
    return this;
  }

  /**
   * step 6: we validate that the index.js file has a require statement
   * for any variant files, to ensure they are not in the inlined (bundled) index.
   */
  async validate() {
    if (this.bailout) {
      return this;
    }
    this.indexContents = fs.readFileSync(this.outfile, "utf-8");

    const externalsToCheck = new Set(
      Object.keys(this.variantMap)
        .filter((variant) => !this.transitiveVariants.includes(variant) && !variant.endsWith("index"))
        .map((variant) => path.basename(variant).replace(/.js$/, ""))
    );

    const inspect = (contents) => {
      for (const line of contents.split("\n")) {
        // we expect to see a line with require() and the variant external in it
        if (line.includes("require(")) {
          const checkOrder = [...externalsToCheck].sort().reverse();
          for (const external of checkOrder) {
            if (line.includes(external)) {
              if (this.verbose) {
                console.log("Inline index confirmed require() for variant external:", external);
              }
              externalsToCheck.delete(external);
            }
          }
        }
      }
    };

    inspect(this.indexContents);

    if (this.hasSubmodules) {
      const submodules = fs.readdirSync(path.join(path.dirname(this.outfile), "submodules"));
      for (const submodule of submodules) {
        const submoduleIndexContents = fs.readFileSync(
          path.join(path.dirname(this.outfile), "submodules", submodule, "index.js"),
          "utf-8"
        );
        inspect(submoduleIndexContents);
      }
    }

    if (externalsToCheck.size) {
      throw new Error(
        "require() statements for the following variant externals: " +
          [...externalsToCheck].join(", ") +
          " were not found in the index."
      );
    }

    // Validate that all source variant files exist as isolates in dist-cjs.
    const srcDir = path.join(this.packageDirectory, "src");
    const distCjsDir = path.join(this.packageDirectory, "dist-cjs");
    const missingVariants = [];
    for await (const file of walk(srcDir)) {
      if (file.match(/\.(browser|native)\.ts$/) && !file.match(/\.spec\.|\.integ\./)) {
        const relativePath = file.replace(srcDir, "").replace(/\.ts$/, ".js");
        const expectedDistFile = path.join(distCjsDir, relativePath);
        if (!fs.existsSync(expectedDistFile)) {
          missingVariants.push(relativePath);
        }
      }
    }
    if (missingVariants.length) {
      throw new Error(
        "The following variant source files are missing from dist-cjs (they may have been incorrectly inlined):\n" +
          missingVariants.join("\n")
      );
    }

    // Validate that package.json has browser/react-native replacement directives for all variants.
    const browserField = this.pkgJson.browser || {};
    const reactNativeField = this.pkgJson["react-native"] || {};
    const missingDirectives = [];
    for await (const file of walk(srcDir)) {
      if (file.match(/\.(browser|native)\.ts$/) && !file.match(/\.spec\.|\.integ\./)) {
        const relativePath = file.replace(srcDir, "").replace(/\.ts$/, "");
        const canonicalPath = relativePath.replace(/\.(browser|native)$/, "");
        const variant = relativePath.match(/\.(browser|native)$/)[1];

        const esCanonical = `./dist-es${canonicalPath}`;
        const esVariant = `./dist-es${relativePath}`;
        const cjsCanonical = `./dist-cjs${canonicalPath}`;
        const cjsVariant = `./dist-cjs${relativePath}`;

        // For react-native, .native takes precedence over .browser.
        const hasNativeVariant = variant === "browser" &&
          fs.existsSync(file.replace(/\.browser\.ts$/, ".native.ts"));

        if (variant === "browser") {
          if (browserField[esCanonical] !== esVariant) {
            browserField[esCanonical] = esVariant;
            missingDirectives.push(`browser["${esCanonical}"] = "${esVariant}"`);
          }
          if (!hasNativeVariant) {
            if (reactNativeField[esCanonical] !== esVariant) {
              reactNativeField[esCanonical] = esVariant;
              missingDirectives.push(`react-native["${esCanonical}"] = "${esVariant}"`);
            }
            if (reactNativeField[cjsCanonical] !== cjsVariant) {
              reactNativeField[cjsCanonical] = cjsVariant;
              missingDirectives.push(`react-native["${cjsCanonical}"] = "${cjsVariant}"`);
            }
          }
        } else if (variant === "native") {
          if (reactNativeField[esCanonical] !== esVariant) {
            reactNativeField[esCanonical] = esVariant;
            missingDirectives.push(`react-native["${esCanonical}"] = "${esVariant}"`);
          }
          if (reactNativeField[cjsCanonical] !== cjsVariant) {
            reactNativeField[cjsCanonical] = cjsVariant;
            missingDirectives.push(`react-native["${cjsCanonical}"] = "${cjsVariant}"`);
          }
        }
      }
    }
    if (missingDirectives.length) {
      this.pkgJson.browser = browserField;
      this.pkgJson["react-native"] = reactNativeField;
      fs.writeFileSync(
        path.join(this.packageDirectory, "package.json"),
        JSON.stringify(this.pkgJson, null, 2) + "\n"
      );
      throw new Error(
        "package.json is missing replacement directives for variant files (entries have been auto-inserted, please review the diff and rebuild):\n" +
          missingDirectives.join("\n")
      );
    }

    // check ESM compat.
    const tmpFileContents =
      `import assert from "node:assert";
      
      const namingExceptions = [
        "paginateOperation", // name for all paginators.
        "blobReader" // name collision between chunked-blob-reader and chunked-blob-reader-native.
      ];
      ` +
      this.canonicalExports
        .filter((sym) => !sym.includes(":"))
        .map((sym) => {
          if (
            [
              "getDefaultClientConfiguration", // renamed as an alias
              "generateIdempotencyToken", // sometimes called v4
              "expectInt", // aliased to expectLong
              "handleFloat", // aliased to limitedParseDouble
              "limitedParseFloat", // aliased to limitedParseDouble
              "strictParseFloat", // aliased to strictParseDouble
              "strictParseInt", // aliased to strictParseLong
              "randomUUID", // bound function from crypto.randomUUID.bind(crypto)
              "blobReaderNative", // re-exported alias of blobReader from chunked-blob-reader-native
              "blobReader", // name collision in bundle between chunked-blob-reader variants
            ].includes(sym)
          ) {
            return `import { ${sym} } from "${this.pkgJson.name}";`;
          }
          return `import { ${sym} } from "${this.pkgJson.name}";
if (typeof ${sym} === "function") {
  if (${sym}.name !== "${sym}" && !namingExceptions.includes(${sym}.name)) {
    throw new Error(${sym}.name + " does not equal expected ${sym}.")
  }
} 
        `;
        })
        .join("\n");
    fs.writeFileSync(path.join(__dirname, "tmp", this.package + ".mjs"), tmpFileContents, "utf-8");
    await spawnProcess("node", [path.join(__dirname, "tmp", this.package + ".mjs")]);
    if (this.verbose) {
      console.log("ESM compatibility verified.");
    }
    fs.rmSync(path.join(__dirname, "tmp", this.package + ".mjs"));

    return this;
  }
};
