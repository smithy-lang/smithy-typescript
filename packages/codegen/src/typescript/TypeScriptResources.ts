import type { JsonObject } from "./TypeScriptSettings";

/**
 * The package.json that generated packages start from, before settings and dependencies are merged in.
 *
 * @internal
 */
export const BASE_PACKAGE_JSON: JsonObject = {
  name: "${package}",
  description: "${packageDescription}",
  version: "${packageVersion}",
  scripts: {
    build: "concurrently '${packageManager}:build:cjs' '${packageManager}:build:es' '${packageManager}:build:types'",
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "build:es": "tsc -p tsconfig.es.json",
    "build:types": "tsc -p tsconfig.types.json",
    "build:types:downlevel": "downlevel-dts dist-types dist-types/ts3.4",
    "test:index": "tsc -p tsconfig.test.json && node ./test/index-objects.spec.mjs",
    clean:
      "premove dist-cjs dist-es dist-types tsconfig.cjs.tsbuildinfo tsconfig.es.tsbuildinfo tsconfig.types.tsbuildinfo",
    prepack: "${packageManager} run clean && ${packageManager} run build",
  },
  main: "./dist-cjs/index.js",
  types: "./dist-types/index.d.ts",
  module: "./dist-es/index.js",
  sideEffects: false,
  dependencies: {
    tslib: "^2.6.2",
  },
  devDependencies: {
    "@tsconfig/node20": "20.1.8",
    concurrently: "7.0.0",
    "downlevel-dts": "0.10.1",
    premove: "4.0.0",
    typescript: "${typescriptVersion}",
  },
  engines: {
    node: ">=20.0.0",
  },
  typesVersions: {
    "<4.5": {
      "dist-types/*": ["dist-types/ts3.4/*"],
    },
  },
  files: ["dist-*/**"],
};

/**
 * The tsconfig.types.json that generated packages start from.
 *
 * @internal
 */
export const TSCONFIG_TYPES: JsonObject = {
  extends: "./tsconfig",
  compilerOptions: {
    removeComments: false,
    declaration: true,
    declarationDir: "dist-types",
    emitDeclarationOnly: true,
    noCheck: false,
  },
};

/**
 * The tsconfig.cjs.json of generated packages.
 *
 * @internal
 */
export const TSCONFIG_CJS: JsonObject = {
  extends: "./tsconfig",
  compilerOptions: {
    outDir: "dist-cjs",
    noCheck: true,
  },
};

/**
 * Files that are written to generated packages as they are, keyed by name.
 *
 * @internal
 */
export const RESOURCES: Readonly<Record<string, string>> = {
  "extensionConfiguration.template": `/**
 * @internal
 */
export interface \${extensionConfigName}
  extends \${extensionConfigInterfaces} {}
`,
  "resolveRuntimeExtensions1.template": `import type { \${extensionConfigName} } from "./extensionConfiguration";

/**
 * @public
 */
export interface RuntimeExtension {
  configure(extensionConfiguration: \${extensionConfigName}): void;
}

/**
 * @public
 */
export interface RuntimeExtensionsConfig {
  extensions: RuntimeExtension[];
}

/**
 * @internal
 */
export const resolveRuntimeExtensions = (runtimeConfig: any, extensions: RuntimeExtension[]) => {
  const extensionConfiguration: \${extensionConfigName} = Object.assign(
\${getPartialExtensionConfigurations}
  );

  extensions.forEach((extension) => extension.configure(extensionConfiguration));
`,
  "resolveRuntimeExtensions2.template": `  return Object.assign(
    runtimeConfig,
\${resolvePartialRuntimeConfigs}
  );
};
`,
  "runtimeConfig.ts.template": `/**
 * @internal
 */
export const getRuntimeConfig = (config: \${clientConfigName}) => {
  emitWarningIfUnsupportedVersion(process.version);
  const defaultsMode = resolveDefaultsModeConfig(config);
  const defaultConfigProvider = () => defaultsMode().then(loadConfigsForDefaultMode);
  const clientSharedValues = getSharedRuntimeConfig(config);
  \${prepareCustomizations}
  return {
    ...clientSharedValues,
    ...config,
    runtime: "node",
    defaultsMode,
\${customizations}
  };
};
`,
  "runtimeConfig.browser.ts.template": `/**
 * @internal
 */
export const getRuntimeConfig = (config: \${clientConfigName}) => {
  const defaultsMode = resolveDefaultsModeConfig(config);
  const defaultConfigProvider = () => defaultsMode().then(loadConfigsForDefaultMode);
  const clientSharedValues = getSharedRuntimeConfig(config);
  \${prepareCustomizations}
  return {
    ...clientSharedValues,
    ...config,
    runtime: "browser",
    defaultsMode,
\${customizations}
  };
};
`,
  "runtimeConfig.native.ts.template": `/**
 * @internal
 */
export const getRuntimeConfig = (config: \${clientConfigName}) => {
  const browserDefaults = getBrowserRuntimeConfig(config);
  \${prepareCustomizations}
  return {
    ...browserDefaults,
    ...config,
    runtime: "react-native",
\${customizations}
  };
};
`,
  "runtimeConfig.shared.ts.template": `/**
 * @internal
 */
export const getRuntimeConfig = (config: \${clientConfigName}) => {
  \${prepareCustomizations}
  return {
    apiVersion: "\${apiVersion}",
\${customizations}
  };
};
`,
  "tsconfig.json": `{
  "extends": "@tsconfig/node20/tsconfig.json",
  "compilerOptions": {
    "importHelpers": true,
    "types": ["node"],
    "removeComments": true,
    "resolveJsonModule": true,
    "rootDir": "src",
    "useUnknownInCatchVariables": false
  },
  "include": ["src"]
}
`,
  "tsconfig.es.json": `{
  "extends": "./tsconfig",
  "compilerOptions": {
    "lib": ["dom"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist-es",
    "noCheck": true
  }
}
`,
  "vitest.config.mts": `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/*.{integ}.spec.ts"],
    include: ["**/*.spec.ts"],
    globals: true,
  },
});
`,
  "vitest.config.integ.mts": `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.integ.spec.ts"],
    environment: "node",
  },
});
`,
};
