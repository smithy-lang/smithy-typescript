import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@smithy/codegen/internal": resolve(__dirname, "src/submodules/internal/index.ts"),
    },
  },
  test: {
    include: ["test/**/*.spec.ts"],
    environment: "node",
    globals: true,
    testTimeout: 120_000,
  },
});
