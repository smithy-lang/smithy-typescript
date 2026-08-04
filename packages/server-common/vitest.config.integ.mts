import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integ.spec.ts", "test/**/*.integ.spec.ts"],
    environment: "node",
  },
});
