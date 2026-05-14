import { execSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";





const require = createRequire(import.meta.url);
const webpack = require("webpack");
const { build: viteBuild } = await import("vite");
const esbuild = require("esbuild");
const { findGlobalBufferRefs } = require("./bundler-output-analysis.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const applicationFolder = path.join(root, "applications");
const distDir = path.join(root, "dist");

// Clean dist
fs.rmSync(path.join(root, "dist-vite"), { recursive: true, force: true });
fs.rmSync(path.join(root, "dist-esbuild"), { recursive: true, force: true });
fs.rmSync(path.join(root, "dist-webpack"), { recursive: true, force: true });
fs.rmSync(path.join(root, "dist-rollup"), { recursive: true, force: true });

fs.mkdirSync(path.join(root, "dist-vite"), { recursive: true });
fs.mkdirSync(path.join(root, "dist-esbuild"), { recursive: true });
fs.mkdirSync(path.join(root, "dist-webpack"), { recursive: true });

const apps = fs.readdirSync(applicationFolder).filter((f) => f.endsWith(".ts") || f.endsWith(".mjs"));

let failed = false;

for (const app of apps) {
  const entry = path.join(applicationFolder, app);
  const baseName = app.replace(/\.[^.]+$/, "");
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Application: ${app}`);
  console.log(`${"=".repeat(60)}`);

  // --- Vite (UMD, no minify, readable) ---
  const viteOutDir = path.join(root, "dist-vite");
  const viteOutFile = path.join(viteOutDir, `${baseName}.umd.cjs`);
  try {
    await viteBuild({
      logLevel: "silent",
      resolve: { conditions: ["browser", "module", "import"] },
      build: {
        outDir: viteOutDir,
        lib: { entry, name: "dist", fileName: baseName, formats: ["umd"] },
        minify: false,
        sourcemap: false,
        emptyOutDir: false,
        rollupOptions: {
          output: { inlineDynamicImports: true },
          treeshake: true,
        },
      },
    });
    console.log(`\n  Vite: ${byteSize(fs.statSync(viteOutFile).size)}`);
    validateBundle("vite", viteOutFile);
  } catch (e) {
    console.error(`  Vite: ❌ FAIL: build error: ${e.message}`);
    failed = true;
  }

  // --- esbuild (ESM, no minify, readable) ---
  const esbuildOutFile = path.join(root, "dist-esbuild", `${baseName}.mjs`);
  try {
    await esbuild.build({
      entryPoints: [entry],
      platform: "browser",
      bundle: true,
      minify: false,
      treeShaking: true,
      mainFields: ["browser", "module", "main"],
      conditions: ["browser", "import"],
      outfile: esbuildOutFile,
      format: "esm",
      target: "es2022",
    });
    console.log(`  esbuild: ${byteSize(fs.statSync(esbuildOutFile).size)}`);
    validateBundle("esbuild", esbuildOutFile);
  } catch (e) {
    console.error(`  esbuild: ❌ FAIL: build error: ${e.message}`);
    failed = true;
  }

  // --- Webpack (UMD, no minify, readable) ---
  const webpackOutFile = path.join(root, "dist-webpack", `${baseName}.js`);
  try {
    await new Promise((resolve, reject) => {
      webpack(
        {
          mode: "development",
          devtool: false,
          entry,
          target: "web",
          resolve: {
            extensions: [".ts", ".js", ".mjs"],
            conditionNames: ["browser", "import", "module", "default"],
            aliasFields: ["browser"],
          },
          output: {
            path: path.dirname(webpackOutFile),
            filename: path.basename(webpackOutFile),
            library: { type: "umd", name: "dist" },
          },
          optimization: { minimize: false, usedExports: true },
          module: {
            rules: [
              {
                test: /\.ts$/,
                use: { loader: "ts-loader", options: { transpileOnly: true } },
                exclude: /node_modules/,
              },
            ],
          },
        },
        (err, stats) => {
          if (err) return reject(err);
          if (stats.hasErrors()) return reject(new Error(stats.toString({ errors: true })));
          resolve();
        }
      );
    });
    console.log(`  Webpack: ${byteSize(fs.statSync(webpackOutFile).size)}`);
    validateBundle("webpack", webpackOutFile);
  } catch (e) {
    console.error(`  Webpack: ❌ FAIL: build error: ${e.message.split("\n").slice(0, 3).join("\n")}`);
    failed = true;
  }
}

console.log(`\n${"=".repeat(60)}`);
if (failed) {
  console.error("❌ Bundler check FAILED");
  process.exit(1);
} else {
  console.log("✅ Bundler check PASSED");
}

function validateBundle(bundler, filePath) {
  const content = fs.readFileSync(filePath, "utf-8");

  // Check for node: protocol references
  const nodeImports = content.match(/["']node:[^"']+["']/g) || [];
  const nodeRequires = content.match(/require\(["']node:[^"']+["']\)/g) || [];
  const allNodeRefs = [...new Set([...nodeImports, ...nodeRequires])];

  if (allNodeRefs.length > 0) {
    console.error(`  ${bundler}: ❌ FAIL: node: protocol references: ${allNodeRefs.join(", ")}`);
    failed = true;
  } else {
    console.log(`  ${bundler}: ✅ PASS: No node: protocol references`);
  }

  // Check for node-only code marker
  const nodeOnlyMatches = content.match(/\w+\s*=\s*Symbol\.for\(["']node-only["']\)/g) || [];
  if (nodeOnlyMatches.length > 3) {
    console.error(`  ${bundler}: ❌ FAIL: ${nodeOnlyMatches.length}/3 Symbol.for("node-only") occurrence(s) — node-only code not fully tree-shaken`);
    failed = true;
  } else if (nodeOnlyMatches.length > 0) {
    console.log(`  ${bundler}: ⚠️  ${nodeOnlyMatches.length}/3 Symbol.for("node-only") occurrence(s) — node-only code not fully tree-shaken`);
  }

  // AST-based global Buffer check
  const globalBufferRefs = findGlobalBufferRefs(content);
  if (globalBufferRefs.length > 0) {
    console.error(`  ${bundler}: ❌ FAIL: ${globalBufferRefs.length} unguarded global Buffer reference(s)`);
    for (const ref of globalBufferRefs.slice(0, 3)) {
      const line = content.split("\n")[ref.line - 1]?.trim().slice(0, 120);
      console.error(`    L${ref.line}: ${line}`);
    }
    if (globalBufferRefs.length > 3) console.error(`    ... and ${globalBufferRefs.length - 3} more`);
    failed = true;
  } else {
    console.log(`  ${bundler}: ✅ PASS: No unguarded global Buffer references`);
  }
}

function byteSize(num) {
  if (num > 1024 ** 2) return ((((num / 1024 ** 2) * 1000) | 0) / 1000).toLocaleString() + " MB";
  if (num > 1024) return ((num / 1024) | 0).toLocaleString() + " KB";
  return num.toLocaleString() + " B";
}
