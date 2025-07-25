import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/*.{integ,e2e,browser}.spec.ts"],
    include: ["**/*.spec.ts"],
    environment: "node",
    hideSkippedTests: true,
  },
});
