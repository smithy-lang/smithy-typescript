import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/sample-app.ts"],
  outDir: "dist/dts",
  format: ["esm"],
  platform: "browser",
  dts: {
    resolve: true,
    compilerOptions: {
      moduleResolution: "bundler",
    },
  },
  external: [/^node:/],
  tsconfig: "tsconfig.json",
});
