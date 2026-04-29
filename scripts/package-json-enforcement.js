const { error } = require("console");
const fs = require("fs");
const path = require("path");

/**
 * This enforcement is not here to prevent adoption of newer
 * package standards such as "exports". It is to ensure consistency in the
 * monorepo until the time comes for those changes.
 * ----
 *
 * The script will enforce several things on a package json object:
 *
 * - main and module must be defined.
 *   In the future this may change. Browser is more standard than module, and
 *   exports may be used for ESM (.mjs) support.
 *
 * - If a react-native entry exists, browser and react native entries must be of the
 *   same type (object replacement directives or string entry point).
 *   If either is not defined, both must not be defined.
 *
 * - when react-native has file replacement directives, it must include both
 *   CJS and ESM dist replacements.
 *
 * - exports must not be defined unless the package name is core.
 */
module.exports = function (pkgJsonFilePath, overwrite = false) {
  const errors = [];

  const pkgJson = require(pkgJsonFilePath);
  if (!pkgJson.name.endsWith("/core")) {
    if ("exports" in pkgJson) {
      errors.push(`${pkgJson.name} must not have an 'exports' field.`);
      if (overwrite) {
        delete pkgJson.exports;
      }
    }
  }

  for (const requiredField of ["main", "module"]) {
    if (!(requiredField in pkgJson)) {
      errors.push(`${requiredField} field missing in ${pkgJson.name}`);
      if (overwrite) {
        switch (requiredField) {
          case "main":
            pkgJson[requiredField] = "./dist-cjs/index.js";
            break;
          case "module":
            pkgJson[requiredField] = pkgJson.main.replace("dist-cjs", "dist-es");
            break;
        }
      }
    }
  }

  if (typeof pkgJson.browser !== typeof pkgJson["react-native"]) {
    errors.push(`browser and react-native fields are different in ${pkgJson.name}`);
  }

  if (!pkgJson.files) {
    errors.push(`no files entry in ${pkgJson.name}`);
  }

  if (typeof pkgJson.browser === "object" && typeof pkgJson["react-native"] === "object") {
    const browserCanonical = Object.entries(pkgJson.browser).reduce((acc, [k, v]) => {
      if (!k.includes("dist-cjs/") || typeof v === "boolean") {
        acc[k] = v;
      }
      return acc;
    }, {});

    if (Object.keys(browserCanonical).length !== Object.keys(pkgJson.browser).length) {
      errors.push(`${pkgJson.name} browser field is incomplete.`);
      if (overwrite) {
        pkgJson.browser = browserCanonical;
      }
    }

    const reactNativeCanonical = [
      ...new Set([
        ...Object.entries(pkgJson["react-native"]).map(([k, v]) => [
          k.replace("dist-cjs", "dist-es"),
          typeof v === "string" ? v.replace("dist-cjs", "dist-es") : v,
        ]),
        ...Object.entries(pkgJson["react-native"]).map(([k, v]) => [
          k.replace("dist-es", "dist-cjs"),
          typeof v === "string" ? v.replace("dist-es", "dist-cjs") : v,
        ]),
      ]),
    ].reduce((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});

    if (Object.keys(reactNativeCanonical).length !== Object.keys(pkgJson["react-native"]).length) {
      errors.push(`${pkgJson.name} react-native field is incomplete.`);
      if (overwrite) {
        pkgJson["react-native"] = reactNativeCanonical;
      }
    }
  }

  // Validate variant replacement directives match source files.
  const pkgDir = path.dirname(pkgJsonFilePath);
  const srcDir = path.join(pkgDir, "src");
  if (fs.existsSync(srcDir)) {
    const browserField = pkgJson.browser || {};
    const reactNativeField = pkgJson["react-native"] || {};
    let didModify = false;

    // Check that every .browser.ts / .native.ts source file has directives.
    const walkSync = (dir) => {
      const results = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...walkSync(fullPath));
        } else {
          results.push(fullPath);
        }
      }
      return results;
    };

    for (const file of walkSync(srcDir)) {
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
            errors.push(`${pkgJson.name} browser["${esCanonical}"] should be "${esVariant}"`);
            if (overwrite) {
              browserField[esCanonical] = esVariant;
              didModify = true;
            }
          }
          if (!hasNativeVariant) {
            if (reactNativeField[esCanonical] !== esVariant) {
              errors.push(`${pkgJson.name} react-native["${esCanonical}"] should be "${esVariant}"`);
              if (overwrite) {
                reactNativeField[esCanonical] = esVariant;
                didModify = true;
              }
            }
            if (reactNativeField[cjsCanonical] !== cjsVariant) {
              errors.push(`${pkgJson.name} react-native["${cjsCanonical}"] should be "${cjsVariant}"`);
              if (overwrite) {
                reactNativeField[cjsCanonical] = cjsVariant;
                didModify = true;
              }
            }
          }
        } else if (variant === "native") {
          if (reactNativeField[esCanonical] !== esVariant) {
            errors.push(`${pkgJson.name} react-native["${esCanonical}"] should be "${esVariant}"`);
            if (overwrite) {
              reactNativeField[esCanonical] = esVariant;
              didModify = true;
            }
          }
          if (reactNativeField[cjsCanonical] !== cjsVariant) {
            errors.push(`${pkgJson.name} react-native["${cjsCanonical}"] should be "${cjsVariant}"`);
            if (overwrite) {
              reactNativeField[cjsCanonical] = cjsVariant;
              didModify = true;
            }
          }
        }
      }
    }

    if (didModify) {
      if (Object.keys(browserField).length) {
        pkgJson.browser = browserField;
      }
      if (Object.keys(reactNativeField).length) {
        pkgJson["react-native"] = reactNativeField;
      }
    }

    // Verify each existing directive points to an actual source file.
    for (const [field, directives] of [["browser", pkgJson.browser], ["react-native", pkgJson["react-native"]]]) {
      if (typeof directives !== "object" || directives === null) {
        continue;
      }
      for (const [canonical, variant] of Object.entries(directives)) {
        if (typeof variant === "boolean") {
          continue;
        }
        if (!variant.startsWith("./")) {
          continue;
        }
        const variantSrcFile = path.join(
          pkgDir,
          variant.replace(/^\.\/dist-(es|cjs)/, "src").replace(/(\.js)?$/, ".ts")
        );
        if (!fs.existsSync(variantSrcFile)) {
          errors.push(`${pkgJson.name} ${field}["${canonical}"] -> "${variant}" has no corresponding source file (expected ${variantSrcFile})`);
        }
      }
    }
  }

  if (overwrite && errors.length) {
    fs.writeFileSync(pkgJsonFilePath, JSON.stringify(pkgJson, null, 2) + "\n");
  }

  return errors;
};
