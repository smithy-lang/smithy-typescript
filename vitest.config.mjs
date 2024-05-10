import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { globals: true },
  exclude: ["*.browser.spec.ts"],
});
