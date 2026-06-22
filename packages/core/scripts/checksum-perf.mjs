import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreDir = resolve(__dirname, "..");
const outputPath = resolve(coreDir, "planning", "checksums.md");

// Import all implementations from the CJS Node.js index (the actual runtime path).
const require = createRequire(import.meta.url);
const checksum = require(resolve(coreDir, "dist-cjs/submodules/checksum/index.js"));
const { Crc32Js, Crc32Node, Sha256Js, Sha256Node } = checksum;

// Import aws-crypto reference implementations.
const { AwsCrc32 } = require("@aws-crypto/crc32");
const { Sha256: AwsSha256 } = require("@aws-crypto/sha256-js");

const SIZES = [32, 256, 1024, 64 * 1024, 1024 * 1024];
const WARMUP = 50;
const ITERATIONS = 500;

function generateData(size) {
  const buf = new Uint8Array(size);
  for (let i = 0; i < size; ++i) {
    buf[i] = i & 0xff;
  }
  return buf;
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${bytes / (1024 * 1024)}MB`;
  if (bytes >= 1024) return `${bytes / 1024}KB`;
  return `${bytes}B`;
}

function formatOps(ops) {
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M ops/sec`;
  if (ops >= 1_000) return `${(ops / 1_000).toFixed(1)}K ops/sec`;
  return `${ops.toFixed(0)} ops/sec`;
}

function formatThroughput(bytesPerSec) {
  if (bytesPerSec >= 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
}

async function benchCrc32JS(data, iterations) {
  for (let i = 0; i < WARMUP; ++i) {
    const h = new Crc32Js();
    h.update(data);
    await h.digest();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new Crc32Js();
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

async function benchSha256JS(data, iterations) {
  for (let i = 0; i < WARMUP; ++i) {
    const h = new Sha256Js();
    h.update(data);
    await h.digest();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new Sha256Js();
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

async function benchSha256HMAC_JS(key, data, iterations) {
  for (let i = 0; i < WARMUP; ++i) {
    const h = new Sha256Js(key);
    h.update(data);
    await h.digest();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new Sha256Js(key);
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

async function benchCrc32Node(data, iterations) {
  for (let i = 0; i < WARMUP; ++i) {
    const h = new Crc32Node();
    h.update(data);
    await h.digest();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new Crc32Node();
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

async function benchSha256Node(data, iterations) {
  for (let i = 0; i < WARMUP; ++i) {
    const h = new Sha256Node();
    h.update(data);
    await h.digest();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new Sha256Node();
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

async function benchSha256HMAC_Node(key, data, iterations) {
  for (let i = 0; i < WARMUP; ++i) {
    const h = new Sha256Node(key);
    h.update(data);
    await h.digest();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new Sha256Node(key);
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

async function benchCrc32AwsCrypto(data, iterations) {
  for (let i = 0; i < WARMUP; ++i) {
    const h = new AwsCrc32();
    h.update(data);
    await h.digest();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new AwsCrc32();
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

async function benchSha256AwsCrypto(data, iterations) {
  for (let i = 0; i < WARMUP; ++i) {
    const h = new AwsSha256();
    h.update(data);
    await h.digest();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new AwsSha256();
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

async function benchSha256HMAC_AwsCrypto(key, data, iterations) {
  for (let i = 0; i < WARMUP; ++i) {
    const h = new AwsSha256(key);
    h.update(data);
    await h.digest();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; ++i) {
    const h = new AwsSha256(key);
    h.update(data);
    await h.digest();
  }
  return performance.now() - start;
}

// --- Run benchmarks ---

console.log("Running checksum benchmarks...\n");

const lines = [];

lines.push("# Checksum Benchmarks\n");
lines.push(`Platform: Node.js ${process.version} (${process.platform} ${process.arch})\n`);
lines.push(`Date: ${new Date().toISOString()}\n`);
lines.push(`Iterations: ${ITERATIONS}, Warmup: ${WARMUP}\n`);

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

// CRC-32
lines.push("\n## CRC-32\n");
{
  const rows = [];
  for (const size of SIZES) {
    const data = generateData(size);
    const iters = size >= 64 * 1024 ? 100 : ITERATIONS;
    const jsMs = await benchCrc32JS(data, iters);
    const nodeMs = await benchCrc32Node(data, iters);
    const awsMs = await benchCrc32AwsCrypto(data, iters);
    const jsThroughput = formatThroughput((size * iters * 1000) / jsMs);
    const nodeThroughput = formatThroughput((size * iters * 1000) / nodeMs);
    const awsThroughput = formatThroughput((size * iters * 1000) / awsMs);
    rows.push([formatSize(size), jsThroughput, nodeThroughput, awsThroughput]);
    console.log(
      `  CRC-32 ${formatSize(size)}: Crc32Js=${jsThroughput}, Crc32Node=${nodeThroughput}, aws-crypto=${awsThroughput}`
    );
  }
  lines.push(...alignedTable(["Size", "Crc32Js (JS)", "Crc32Node (node:zlib)", "@aws-crypto/crc32"], rows));
}

// SHA-256 hash
lines.push("\n## SHA-256 (hash)\n");
{
  const rows = [];
  for (const size of SIZES) {
    const data = generateData(size);
    const iters = size >= 64 * 1024 ? 100 : ITERATIONS;
    const jsMs = await benchSha256JS(data, iters);
    const nodeMs = await benchSha256Node(data, iters);
    const awsMs = await benchSha256AwsCrypto(data, iters);
    const jsThroughput = formatThroughput((size * iters * 1000) / jsMs);
    const nodeThroughput = formatThroughput((size * iters * 1000) / nodeMs);
    const awsThroughput = formatThroughput((size * iters * 1000) / awsMs);
    rows.push([formatSize(size), jsThroughput, nodeThroughput, awsThroughput]);
    console.log(
      `  SHA-256 ${formatSize(size)}: Sha256Js=${jsThroughput}, Sha256Node=${nodeThroughput}, aws-crypto=${awsThroughput}`
    );
  }
  lines.push(...alignedTable(["Size", "Sha256Js (JS)", "Sha256Node (node:crypto)", "@aws-crypto/sha256-js"], rows));
}

// SHA-256 HMAC
lines.push("\n## SHA-256 (HMAC)\n");
{
  const rows = [];
  const hmacKey = generateData(32);
  for (const size of SIZES) {
    const data = generateData(size);
    const iters = size >= 64 * 1024 ? 100 : ITERATIONS;
    const jsMs = await benchSha256HMAC_JS(hmacKey, data, iters);
    const nodeMs = await benchSha256HMAC_Node(hmacKey, data, iters);
    const awsMs = await benchSha256HMAC_AwsCrypto(hmacKey, data, iters);
    const jsThroughput = formatThroughput((size * iters * 1000) / jsMs);
    const nodeThroughput = formatThroughput((size * iters * 1000) / nodeMs);
    const awsThroughput = formatThroughput((size * iters * 1000) / awsMs);
    rows.push([formatSize(size), jsThroughput, nodeThroughput, awsThroughput]);
    console.log(
      `  HMAC-SHA-256 ${formatSize(size)}: Sha256Js=${jsThroughput}, Sha256Node=${nodeThroughput}, aws-crypto=${awsThroughput}`
    );
  }
  lines.push(...alignedTable(["Size", "Sha256Js (JS)", "Sha256Node (node:crypto)", "@aws-crypto/sha256-js"], rows));
}

const md = lines.join("\n") + "\n";
writeFileSync(outputPath, md);
console.log(`\nResults written to ${outputPath}`);
