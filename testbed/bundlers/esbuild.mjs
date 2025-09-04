import esbuild from "esbuild";

const buildOptions = {
  platform: "browser",
  target: ["es2020"],
  bundle: true,
  format: "esm",
  mainFields: ["module", "browser", "main"],
  allowOverwrite: true,
  entryPoints: ["./source.ts"],
  supported: {
    "dynamic-import": true,
  },
  outfile: "./dist/esbuild-dist.js",
  keepNames: true,
  external: [],
};

await esbuild.build(buildOptions);
