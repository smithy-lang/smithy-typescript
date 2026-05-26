import { defineConfig } from "vitest/config";

const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);

export default defineConfig({
  test: {
    exclude: [
      "node_modules",
      "**/*.{integ,e2e,browser}.spec.ts",
      "smithy-typescript-ssdk-libs",
      "packages/types",
      "packages/util-defaults-mode-browser",
      // undici-http-handler requires Node.js >= 20.
      ...(nodeMajor < 20 ? ["packages/undici-http-handler"] : []),
    ],
    include: ["packages/**/*.spec.ts", "private/**/*.spec.ts"],
    environment: "node",
    globals: true,
  },
});
