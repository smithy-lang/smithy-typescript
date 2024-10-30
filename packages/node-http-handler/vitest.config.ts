import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/*.{e2e,browser}.spec.ts"],
    include: ["**/*.spec.ts"],
    environment: "node",
  },
});
