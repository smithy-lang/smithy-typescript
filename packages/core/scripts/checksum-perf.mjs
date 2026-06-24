import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreDir = resolve(__dirname, "..");
const outputPath = resolve(coreDir, "planning", "checksums.md");

const require = createRequire(import.meta.url);
const checksum = require(resolve(coreDir, "dist-cjs/submodules/checksum/index.js"));
const { Crc32Js, Crc32Node, Sha256Js, Sha256Node, Md5Js, Md5Node } = checksum;
const { AwsCrc32 } = require("@aws-crypto/crc32");
const { Sha256: AwsSha256 } = require("@aws-crypto/sha256-js");

const SIZES =      [32,    256,   1024,  64 * 1024, 1024 * 1024, 10 * 1024 * 1024, 50 * 1024 * 1024];
const ITERATIONS = [10000, 5000,  2000,  200,       20,          5,                3              ];

function generateData(size) {
  const buf = new Uint8Array(size);
  for (let i = 0; i < size; ++i) {
    buf[i] = i & 0xff;
  }
  return buf;
}

const WARMUP_DATA = generateData(64 * 1024);

/**
 * Runs algo on 64KB data for 1 second to ensure V8 optimization.
 */
async function warmup(Impl, ...ctorArgs) {
  const deadline = performance.now() + 1000;
  while (performance.now() < deadline) {
    const h = new Impl(...ctorArgs);
    h.update(WARMUP_DATA);
    await h.digest();
  }
}

async function bench(Impl, data, iterations, ...ctorArgs) {
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new Impl(...ctorArgs);
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${bytes / (1024 * 1024)}MB`;
  if (bytes >= 1024) return `${bytes / 1024}KB`;
  return `${bytes}B`;
}

function formatThroughput(bytesPerSec) {
  if (bytesPerSec >= 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
}

function alignedTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const pad = (s, i) => s.padEnd(widths[i]);
  const sep = widths.map((w) => "-".repeat(w));
  const out = [];
  out.push("| " + headers.map(pad).join(" | ") + " |");
  out.push("| " + sep.join(" | ") + " |");
  for (const row of rows) {
    out.push("| " + row.map(pad).join(" | ") + " |");
  }
  return out;
}

async function runSection(label, impls, extraCtorArgs) {
  const rows = [];
  for (let si = 0; si < SIZES.length; ++si) {
    const size = SIZES[si];
    const data = generateData(size);
    const iters = ITERATIONS[si];
    const row = [formatSize(size)];
    const parts = [];
    for (const { name, Impl, ctorArgs } of impls) {
      const ms = await bench(Impl, data, iters, ...(ctorArgs || []));
      const tp = formatThroughput((size * iters * 1000) / ms);
      row.push(tp);
      parts.push(`${name}=${tp}`);
    }
    rows.push(row);
    console.log(`  ${label} ${formatSize(size)}: ${parts.join(", ")}`);
  }
  return rows;
}

// --- Benchmark definitions ---

const sections = [
  {
    title: "CRC-32",
    headers: ["Size", "Crc32Js (JS)", "Crc32Node (node:zlib)", "@aws-crypto/crc32"],
    impls: [
      { name: "Crc32Js", Impl: Crc32Js },
      { name: "Crc32Node", Impl: Crc32Node },
      { name: "@aws-crypto/crc32", Impl: AwsCrc32 },
    ],
  },
  {
    title: "SHA-256 (hash)",
    headers: ["Size", "Sha256Js (JS)", "Sha256Node (node:crypto)", "@aws-crypto/sha256-js"],
    impls: [
      { name: "Sha256Js", Impl: Sha256Js },
      { name: "Sha256Node", Impl: Sha256Node },
      { name: "@aws-crypto/sha256-js", Impl: AwsSha256 },
    ],
  },
  {
    title: "SHA-256 (HMAC)",
    headers: ["Size", "Sha256Js (JS)", "Sha256Node (node:crypto)", "@aws-crypto/sha256-js"],
    impls: [
      { name: "Sha256Js", Impl: Sha256Js, ctorArgs: [generateData(32)] },
      { name: "Sha256Node", Impl: Sha256Node, ctorArgs: [generateData(32)] },
      { name: "@aws-crypto/sha256-js", Impl: AwsSha256, ctorArgs: [generateData(32)] },
    ],
  },
  {
    title: "MD5",
    note: "Md5Js vs old @smithy/md5-js (unrolled rounds): 0.9x (32B), 2.2x (256B), 2.2x (1KB), 2.1x (64KB), 2.1x (1MB)",
    headers: ["Size", "Md5Js (JS)", "Md5Node (node:crypto)"],
    impls: [
      { name: "Md5Js", Impl: Md5Js },
      { name: "Md5Node", Impl: Md5Node },
    ],
  },
];

// --- Run ---

console.log("Warming up...");
const allImpls = sections.flatMap((s) => s.impls);
for (const { name, Impl, ctorArgs } of allImpls) {
  process.stdout.write(`  ${name}...`);
  await warmup(Impl, ...(ctorArgs || []));
  console.log(" done");
}
await new Promise((r) => setTimeout(r, 1000));

console.log("Running checksum benchmarks...\n");

const lines = [
  "# Checksum Benchmarks\n",
  `Platform: Node.js ${process.version} (${process.platform} ${process.arch})\n`,
  `Date: ${new Date().toISOString()}\n`,
  `Iterations per size: [${ITERATIONS.join(", ")}], Warmup: 1s per algo\n`,
];

for (const { title, headers, impls, note } of sections) {
  lines.push(`\n## ${title}\n`);
  if (note) {
    lines.push(`${note}\n`);
  }
  const rows = await runSection(title, impls);
  lines.push(...alignedTable(headers, rows));
}

const md = lines.join("\n") + "\n";
writeFileSync(outputPath, md);
console.log(`\nResults written to ${outputPath}`);
