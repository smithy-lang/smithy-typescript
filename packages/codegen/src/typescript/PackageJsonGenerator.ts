import type { FileManifest, SymbolDependency } from "../codegen-core";
import type { JsonObject } from "./TypeScriptSettings";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import { TypeScriptDependency } from "./TypeScriptDependency";
import { TypeScriptUtils } from "./TypeScriptUtils";
import { BASE_PACKAGE_JSON } from "./TypeScriptResources";

const PACKAGE_JSON_FILENAME = "package.json";
const VITEST_CONFIG_FILENAME = "vitest.config.mts";
const VITEST_CONFIG_INTEG_FILENAME = "vitest.config.integ.mts";

/**
 * Writes package.json and the test runner configuration files.
 */
export class PackageJsonGenerator {
  public static writePackageJson(
    settings: TypeScriptSettings,
    manifest: FileManifest,
    dependencies: Map<string, Map<string, SymbolDependency>>
  ): void {
    const userSupplied = settings.getPackageJson();
    const defaults = structuredClone(BASE_PACKAGE_JSON);
    const mergedScripts = {
      ...(defaults.scripts as JsonObject),
      ...(userSupplied.scripts as JsonObject | undefined),
    };
    let node: JsonObject = { ...defaults, ...userSupplied, scripts: mergedScripts };

    for (const [dependencyType, entries] of dependencies) {
      const current = { ...(node[dependencyType] as JsonObject | undefined) };
      for (const [name, dependency] of entries) {
        current[name] = dependency.getVersion();
      }
      node = { ...node, [dependencyType]: current };
    }

    const devDependencies = (node.devDependencies as JsonObject | undefined) ?? {};
    if (TypeScriptDependency.VITEST.packageName in devDependencies) {
      const exec = settings.getPackageManagerExecCommand();
      node = {
        ...node,
        scripts: {
          ...(node.scripts as JsonObject),
          test: `${exec} vitest run --passWithNoTests`,
          "test:watch": `${exec} vitest watch --passWithNoTests`,
          "test:integration": `${exec} vitest run --passWithNoTests -c vitest.config.integ.mts`,
          "test:integration:watch": `${exec} vitest watch --passWithNoTests -c vitest.config.integ.mts`,
        },
      };
      manifest.writeFile(VITEST_CONFIG_FILENAME, TypeScriptUtils.loadResourceAsString(VITEST_CONFIG_FILENAME));
      manifest.writeFile(
        VITEST_CONFIG_INTEG_FILENAME,
        TypeScriptUtils.loadResourceAsString(VITEST_CONFIG_INTEG_FILENAME)
      );
    }

    if (settings.generateClient()) {
      node = {
        ...node,
        browser: {
          ...(node.browser as JsonObject | undefined),
          "./dist-es/runtimeConfig": "./dist-es/runtimeConfig.browser",
        },
        "react-native": {
          ...(node["react-native"] as JsonObject | undefined),
          "./dist-es/runtimeConfig": "./dist-es/runtimeConfig.native",
        },
      };
    }
    if (settings.isPrivate()) {
      node = { ...node, private: true };
    }
    if (!settings.generateIndexTests()) {
      const { "test:index": _removed, ...scripts } = node.scripts as JsonObject;
      node = { ...node, scripts };
    }

    if (settings.getVersioningScheme() === "@smithy/core") {
      settings.setPackageVersion(TypeScriptDependency.getSmithyCoreVersion() as string);
    }
    if (settings.getVersioningScheme() === "@aws-sdk/client") {
      settings.setPackageVersion(TypeScriptDependency.getAwsSdkLeadingClientVersion());
    }

    const replacements: [string, string][] = [
      ["${package}", settings.getPackageName()],
      ["${packageDescription}", settings.getPackageDescription()],
      ["${packageVersion}", settings.getPackageVersion()],
      ["${packageManager}", settings.getPackageManagerCommand()],
      ["${typescriptVersion}", settings.getTypescriptVersion()],
    ];
    let template = JSON.stringify(node, null, 4);
    for (const [placeholder, value] of replacements) {
      template = template.split(placeholder).join(value);
    }
    manifest.writeFile(PACKAGE_JSON_FILENAME, template);
  }
}
