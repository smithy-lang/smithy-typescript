import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bundledSource = path.join(__dirname, "..", "src", "elliptic", "Ec.ts");

const buildOptions = {
  platform: "browser",
  target: ["node16"],
  bundle: true,
  format: "esm",
  mainFields: ["module", "main"],
  allowOverwrite: true,
  entryPoints: [path.join(__dirname, "Ec.js")],
  supported: {},
  outfile: bundledSource,
  keepNames: false,
  external: [],
};

await esbuild.build(buildOptions);

const typescript = fs.readFileSync(bundledSource, "utf-8");

fs.writeFileSync(
  bundledSource,
  `// @ts-nocheck
/* eslint-disable */
` + typescript,
  "utf-8"
);