import * as esbuild from "esbuild";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const buildOptions = {
  platform: "browser",
  target: ["node16"],
  bundle: true,
  format: "esm",
  mainFields: ["module", "main"],
  allowOverwrite: true,
  entryPoints: [path.join(__dirname, "Ec.js")],
  supported: {},
  outfile: path.join(__dirname, "..", "src", "elliptic", "Ec.js"),
  keepNames: false,
  external: [],
};

await esbuild.build(buildOptions);
