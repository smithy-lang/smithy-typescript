import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/es/**"],
    include: ["**/*.spec.ts"],
    environment: "node",
  },
});
