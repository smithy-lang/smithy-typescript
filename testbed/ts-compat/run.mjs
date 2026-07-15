/**
 * TypeScript compatibility test runner.
 *
 * For every TypeScript version listed in typescript-versions.json, this script:
 *   1. Installs that TypeScript version in isolation (under .tmp/).
 *   2. Type-checks fixtures/index.ts - which imports and uses one generated
 *      client per codegen variant - against it. The clients' published .d.ts are
 *      parsed (so downlevel *syntax* incompatibilities surface), while
 *      skipLibCheck avoids failing on their internal Node references (see
 *      tsconfig.json).
 *
 * The generated clients (and their transitive @smithy/* dependencies) are
 * resolved from the workspace root node_modules. smithy-typescript is a yarn
 * workspace, so those packages are symlinked there once installed and built;
 * `tsc` walks up from this directory to find them. No isolated dependency
 * install is needed here - only the TypeScript compiler is installed per
 * version (see worker.mjs).
 *
 * Work is parallelized across a pool of worker threads sized to the number of
 * available processors (os.cpus().length).
 *
 * Usage: node ./run.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

// import.meta.dirname is only available on Node 20.11+, so derive it from the
// module URL to keep the runner working on older Node versions in CI.
const root = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(root, "..", "..");

// The versions under test live in typescript-versions.json (oldest -> newest)
// so the support range can be updated without touching runner logic. Each entry
// is { version: string, tscArgs?: string[] } where `version` is any spec npm
// accepts (a bare minor like "5.4" installs its latest patch) and `tscArgs`
// holds compiler options that CHANGED for that version and must be passed on
// the command line (overriding tsconfig.json) so the shared base config stays
// valid everywhere. Past examples of why an entry needed tscArgs:
//   - `moduleResolution: node` (node10) became a deprecation *error* in TS 6.0.
//   - `moduleResolution: node` (node10) was removed in TS 7.0; `bundler`
//     resolution requires `module: preserve` (or esnext).
const VERSIONS_FILE = path.join(root, "typescript-versions.json");

// Generated clients imported by the fixture, mapped to the node_modules path
// their types resolve through. They must be built (dist-types present) for the
// fixture to type-check.
const CLIENTS = [
  "@smithy/smithy-rpcv2-cbor",
  "@smithy/smithy-rpcv2-cbor-schema",
  "xyz",
  "xyz-schema",
];

/**
 * Load the version specs under test.
 * @returns {{ version: string, tscArgs: string[] }[]}
 */
function loadVersions() {
  /** @type {{ version: string, tscArgs?: string[] }[]} */
  const specs = JSON.parse(readFileSync(VERSIONS_FILE, "utf8"));
  return specs.map(({ version, tscArgs = [] }) => ({ version, tscArgs }));
}

/**
 * Ensure the workspace clients are installed and built (dist-types present).
 * The clients are consumed through the workspace root node_modules, so their
 * .d.ts must exist on disk for the fixture to resolve them.
 */
function ensureClientsReady() {
  const missing = CLIENTS.filter(
    (name) =>
      !existsSync(path.join(workspaceRoot, "node_modules", ...name.split("/"), "dist-types", "index.d.ts"))
  );
  if (missing.length > 0) {
    console.error(
      `\nThe following generated clients are not available/built (dist-types missing): ${missing.join(", ")}.\n` +
        `Generate and build them first from the workspace root, e.g.:\n` +
        `  make generate-protocol-tests\n` +
        `or ensure 'yarn' has linked them and they have been built (make build-packages).\n`
    );
    process.exit(1);
  }
}

/**
 * Run all compile jobs across a worker pool.
 * @param {{ version: string, tscArgs: string[] }[]} versions
 */
async function runPool(versions) {
  const poolSize = Math.max(1, Math.min(os.cpus().length, versions.length));

  const queue = [...versions];
  /** @type {{ version: string, ok: boolean, output: string }[]} */
  const results = [];

  await new Promise((resolve, reject) => {
    let active = 0;

    const workerPath = path.join(root, "worker.mjs");

    const spawnWorker = () => {
      const job = queue.shift();
      if (!job) {
        return;
      }
      active++;
      const worker = new Worker(workerPath, { workerData: { root, job } });

      worker.once("message", (res) => {
        results.push(res);
        worker.terminate();
      });
      worker.once("error", reject);
      worker.once("exit", () => {
        active--;
        if (queue.length > 0) {
          spawnWorker();
        } else if (active === 0) {
          resolve(undefined);
        }
      });
    };

    for (let i = 0; i < poolSize; i++) {
      spawnWorker();
    }
  });

  return results;
}

ensureClientsReady();
const versions = loadVersions();
const results = await runPool(versions);

results.sort(
  (a, b) => versions.findIndex((v) => v.version === a.version) - versions.findIndex((v) => v.version === b.version)
);

const failures = results.filter((r) => !r.ok);

console.log("\n" + "=".repeat(60));
console.log("TypeScript compatibility summary");
console.log("=".repeat(60));
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  typescript@${r.version}`);
}

if (failures.length > 0) {
  for (const f of failures) {
    console.error(`\nFAIL typescript@${f.version}:\n${f.output.trim()}`);
  }
  process.exit(1);
}
