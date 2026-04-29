import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "node_modules",
      "**/*.{integ,e2e,browser}.spec.ts",
      "smithy-typescript-ssdk-libs",
      "packages/types",
      "packages/util-defaults-mode-browser",
    ],
    include: ["packages/**/*.spec.ts", "private/**/*.spec.ts"],
    environment: "node",
    globals: true,
  },
});
