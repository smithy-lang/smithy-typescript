import path from "node:path";
import fs from "node:fs";
import webpack from "webpack";
import { build } from "vite";
import esbuild from "esbuild";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Gives file stats for a selection of bundlers and application types.
 */
export class BundlerSizeBenchmarker {
  constructor({ application }) {
    this.application = application;
  }

  /**
   * Create a Webpack bundle.
   * @returns {Promise<{app:string,size:string,bundler:string}>}
   */
  async webpack() {
    const outfile = path.resolve(__dirname, "..", "dist-webpack", `webpack-dist-${this.application}.js`);

    const config = {
      mode: "production",
      entry: path.resolve(__dirname, "..", "applications", this.application),
      target: "web",
      resolve: {
        conditionNames: ["browser", "import", "module"],
        aliasFields: ["browser"],
      },
      output: {
        path: path.dirname(outfile),
        filename: path.basename(outfile),
        library: "dist",
      },
      optimization: {
        minimize: true,
        splitChunks: false,
        runtimeChunk: false,
        sideEffects: true,
        usedExports: true,
      },
      stats: {
        optimizationBailout: false,
      },
    };
    return new Promise((resolve) => {
      webpack(config, (err, stats) => {
        if (err) {
          console.error(err);
          throw err;
        }
        const stat = fs.statSync(outfile);
        resolve(this.report(stat, "webpack", outfile));
      });
    });
  }

  /**
   * Create a Rollup bundle.
   * @returns {Promise<{app:string,size:string,bundler:string}>}
   */
  async rollup() {
    const inputFile = path.resolve(__dirname, "..", "applications", this.application);
    const outfile = path.resolve(__dirname, "..", "dist-vite", `vite-${this.application}.umd.cjs`);

    await build({
      logLevel: "silent",
      resolve: {
        conditions: ["browser", "module", "import"],
      },
      build: {
        outDir: "./dist-vite",
        lib: {
          entry: inputFile,
          name: "dist",
          fileName: `vite-${this.application}`,
        },
        minify: true,
        emptyOutDir: false,
        rollupOptions: {
          input: {
            input: inputFile,
          },
          external: [],
          output: {
            dir: path.dirname(outfile),
            inlineDynamicImports: true,
          },
        },
      },
    });

    const stat = fs.statSync(outfile);
    return this.report(stat, "rollup", outfile);
  }

  async rollupNoMinification() {
    const inputFile = path.resolve(__dirname, "..", "applications", this.application);
    const outfile = path.resolve(__dirname, "..", "dist-rollup", `rollup-${this.application}.umd.cjs`);

    await build({
      logLevel: "silent",
      resolve: {
        conditions: ["browser", "module", "import"],
      },
      build: {
        outDir: "./dist-rollup",
        lib: {
          entry: inputFile,
          name: "dist",
          fileName: `rollup-${this.application}`,
        },
        minify: false,
        emptyOutDir: false,
        rollupOptions: {
          input: {
            input: inputFile,
          },
          external: [],
          output: {
            dir: path.dirname(outfile),
            inlineDynamicImports: true,
          },
        },
      },
    });

    const stat = fs.statSync(outfile);
    return this.report(stat, "rollup_no_minification", outfile);
  }

  /**
   * Create a Esbuild bundle.
   * @returns {Promise<{app:string,size:string,bundler:string}>}
   */
  async esbuild() {
    const entryPoint = path.resolve(__dirname, "..", "applications", this.application);
    const outfile = path.resolve(__dirname, "..", "dist-esbuild", `esbuild-dist-${this.application}.js`);

    await esbuild.build({
      entryPoints: [entryPoint],
      platform: "browser",
      bundle: true,
      minify: true,
      mainFields: ["browser", "module", "main"],
      outfile: outfile,
      format: "esm",
      target: "es2022",
    });

    const stat = fs.statSync(outfile);
    return this.report(stat, "esbuild", outfile);
  }

  async all() {
    const stats = await Promise.all([
      this.rollup(), //
      this.rollupNoMinification(),
      this.webpack(), //
      // this.esbuild(), //
    ]);
    const data = {
      app: this.application,
    };
    for (const stat of stats) {
      data[stat.bundler] = stat.size;
    }
    return data;
  }

  /**
   * @param {fs.Stats} stat
   * @param {string} bundler
   * @param {string} outfile
   * @returns {{app, size: string}}
   */
  report(stat, bundler, outfile) {
    if (outfile) {
      const contents = fs.readFileSync(outfile, "utf-8");
      if (/\w+\s*=\s*Symbol\.for\(["']node-only["']\)/.test(contents)) {
        throw new Error(
          `${this.application} (${bundler}): bundle assigns Symbol.for("node-only") to a variable — node-only code was not tree-shaken.`
        );
      }
    }
    return {
      app: this.application,
      size: byteSize(stat.size),
      bundler: bundler,
    };
  }
}

/**
 * @param {number} num - of bytes.
 * @returns {string} bytes in readable format.
 */
function byteSize(num) {
  if (num > 1024 ** 2) {
    return ((((num / 1024 ** 2) * 1000) | 0) / 1000).toLocaleString() + " mb";
  }
  if (num > 1024) {
    return ((num / 1024) | 0).toLocaleString() + " kb";
  }
  return num.toLocaleString() + " b";
}
