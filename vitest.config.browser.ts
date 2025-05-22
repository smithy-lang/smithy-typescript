import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["node_modules"],
    include: ["{packages,private}/**/*.browser.spec.ts"],
    environment: "happy-dom",
  },
});
