#!/usr/bin/env npx tsx
/**
 * Benchmark: JSON shape serializers and deserializers
 *
 * Runs each serializer/deserializer variant in a separate child process to avoid
 * JIT/GC state contamination between variants.
 *
 * Usage:
 *   npx tsx scripts/benchmark-json-serializer.ts
 *   npx tsx scripts/benchmark-json-serializer.ts --variant=multipass
 *   npx tsx scripts/benchmark-json-serializer.ts --variant=byte
 *   npx tsx scripts/benchmark-json-serializer.ts --variant=deser-original
 *   npx tsx scripts/benchmark-json-serializer.ts --variant=deser-buffer
 *   npx tsx scripts/benchmark-json-serializer.ts --variant=deser-buffer-bytes
 */

import { execFileSync } from "node:child_process";
import { NumericValue } from "@smithy/core/serde";
import type {
  StaticStructureSchema,
  TimestampEpochSecondsSchema,
  BigIntegerSchema,
  BigDecimalSchema,
  BlobSchema,
  NumericSchema,
  StringSchema,
  TimestampDefaultSchema,
  StaticListSchema,
} from "@smithy/types";

import { JsonShapeSerializer } from "../src/submodules/protocols/json/codec-v1/JsonShapeSerializer";
import { JsonShapeDeserializer } from "../src/submodules/protocols/json/codec-v1/JsonShapeDeserializer";
import { JsonShapeSerializer2 } from "../src/submodules/protocols/json/codec-v2/JsonShapeSerializer2";
import { JsonShapeDeserializer2 } from "../src/submodules/protocols/json/codec-v2/JsonShapeDeserializer2";

// ─── Configuration ───────────────────────────────────────────────────────────

/** Controls the number of iterations for all scenarios. Higher = more stable results, slower run. */
const SCALE = 10;

// ─── Schemas ─────────────────────────────────────────────────────────────────

const widget = [
  3,
  "",
  "Struct",
  0,
  ["list", "sparseList", "map", "sparseMap", "blob", "media", "timestamp", "bigint", "bigdecimal", "scalar"],
  [
    [[1, "", "List", 0, 0] satisfies StaticListSchema, 0],
    [[1, "", "List", 0, 0] satisfies StaticListSchema, { sparse: 1 }],
    [2, "", "Map", 0, 0, 0],
    [[2, "", "Map", 0, 0, 0], { sparse: 1 }],
    21 satisfies BlobSchema,
    [0, "", "Media", { mediaType: "application/json" }, 0],
    7 satisfies TimestampEpochSecondsSchema,
    17 satisfies BigIntegerSchema,
    19 satisfies BigDecimalSchema,
    1 satisfies NumericSchema,
  ],
] satisfies StaticStructureSchema;

const nestingWidget: StaticStructureSchema = [
  3,
  "ns",
  "Struct",
  0,
  ["string", "date", "blob", "number", "list", "map", "nested"],
  [
    0 satisfies StringSchema,
    4 satisfies TimestampDefaultSchema,
    21 satisfies BlobSchema,
    1 satisfies NumericSchema,
    64 | 1,
    128 | 0,
    () => nestingWidget,
  ],
];

const noBlobWidget: any = [
  3,
  "ns",
  "Struct",
  0,
  ["string", "date", "number", "list", "map", "nested"],
  [0, 4, 1, 64 | 1, 128 | 0, () => noBlobWidget],
];

const wideMapSchema = [3, "", "WideMap", 0, ["tags"], [[2, "", "Map", 0, 0, 0]]] satisfies StaticStructureSchema;

const listStringSchema = [
  3,
  "",
  "StringListInput",
  0,
  ["items"],
  [[1, "", "StringList", 0, 0 satisfies StringSchema]],
] satisfies StaticStructureSchema;
const listFloatSchema = [
  3,
  "",
  "FloatListInput",
  0,
  ["items"],
  [[1, "", "FloatList", 0, 1 satisfies NumericSchema]],
] satisfies StaticStructureSchema;
const listBlobSchema = [
  3,
  "",
  "BlobListInput",
  0,
  ["items"],
  [[1, "", "BlobList", 0, 21 satisfies BlobSchema]],
] satisfies StaticStructureSchema;
const mapStringStringSchema = [
  3,
  "",
  "StringMap",
  0,
  ["entries"],
  [[2, "", "Map", 0, 0, 0]],
] satisfies StaticStructureSchema;

// ─── Data generators ─────────────────────────────────────────────────────────

function createNestingWidget(nesting = 0): any {
  const object: any = {
    string: "hello, world",
    number: 100000,
    list: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    map: { a: "A", b: "B", c: "C" },
    date: new Date(0),
    blob: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
    nested: undefined,
  };
  if (nesting > 0) {
    object.nested = createNestingWidget(nesting - 1);
  }
  return object;
}

function createNoBlobWidget(nesting = 0): any {
  const object: any = {
    string: "hello, world",
    number: 100000,
    list: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    map: { a: "A", b: "B", c: "C" },
    date: new Date(0),
    nested: undefined,
  };
  if (nesting > 0) {
    object.nested = createNoBlobWidget(nesting - 1);
  }
  return object;
}

function createWideMap(numKeys: number) {
  const tags: Record<string, string> = {};
  for (let i = 0; i < numKeys; i++) {
    tags[`key-${i.toString().padStart(4, "0")}`] = `value-${i}-${"x".repeat(20)}`;
  }
  return { tags };
}

function createEscapyMap(numKeys: number) {
  const tags: Record<string, string> = {};
  for (let i = 0; i < numKeys; i++) {
    tags[`key-"${i}"\n`] = `val\t${i}\u0000${'abc"\\'.repeat(5)}`;
  }
  return { tags };
}

function createListString(count: number) {
  const l: string[] = [];
  for (let i = 0; i < count; i++) l[i] = "string".repeat(((Math.random() * 35) | 0) + 1);
  return l;
}

function createListFloat(count: number) {
  const l: number[] = [];
  for (let i = 0; i < count; i++) l[i] = Math.random() * 3.4e38;
  return l;
}

function createMapStringString(count: number) {
  const m: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    m["key".repeat(((Math.random() * 10) | 0) + 1) + i] = "val".repeat(((Math.random() * 50) | 0) + 1) + i;
  }
  return { entries: m };
}

// ─── Scenario definitions ────────────────────────────────────────────────────

interface Scenario {
  name: string;
  schema: any;
  data: unknown;
  iterations: number;
}

function getScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];

  for (const depth of [4, 16, 64, 256, 1024]) {
    scenarios.push({
      name: `nested-struct (depth=${depth})`,
      schema: nestingWidget,
      data: createNestingWidget(depth),
      iterations: depth > 256 ? SCALE : SCALE * 4,
    });
  }

  for (const depth of [16, 64, 256, 1024]) {
    scenarios.push({
      name: `no-blob nested (depth=${depth})`,
      schema: noBlobWidget,
      data: createNoBlobWidget(depth),
      iterations: depth > 256 ? SCALE : SCALE * 4,
    });
  }

  for (const keys of [100, 500, 1000, 5000, 10000]) {
    scenarios.push({
      name: `wide-map (keys=${keys})`,
      schema: wideMapSchema,
      data: createWideMap(keys),
      iterations: keys > 5000 ? SCALE : SCALE * 2,
    });
  }

  for (const keys of [100, 1000, 5000]) {
    scenarios.push({
      name: `escape-heavy map (keys=${keys})`,
      schema: wideMapSchema,
      data: createEscapyMap(keys),
      iterations: keys > 1000 ? SCALE : SCALE * 2,
    });
  }

  scenarios.push({
    name: "small struct (widget)",
    schema: widget,
    data: {
      timestamp: new Date(0),
      bigint: 10000000000000000000000054321n,
      bigdecimal: new NumericValue("0.10000000000000000000000054321", "bigDecimal"),
      blob: new Uint8Array([0, 0, 0, 1]),
    },
    iterations: SCALE * 80,
  });

  // String-heavy / numeric-heavy cases (JSON2 regression candidates)
  for (const count of [1000, 5000, 30000]) {
    scenarios.push({
      name: `list<string> (n=${count})`,
      schema: listStringSchema,
      data: { items: createListString(count) },
      iterations: count > 5000 ? SCALE : SCALE * 2,
    });
  }

  for (const count of [1000, 10000, 30000]) {
    scenarios.push({
      name: `list<float> (n=${count})`,
      schema: listFloatSchema,
      data: { items: createListFloat(count) },
      iterations: count > 10000 ? SCALE : SCALE * 2,
    });
  }

  for (const count of [500, 2000, 5000]) {
    scenarios.push({
      name: `map<str,str> (n=${count})`,
      schema: mapStringStringSchema,
      data: createMapStringString(count),
      iterations: count > 2000 ? SCALE : SCALE * 2,
    });
  }

  for (const kb of [16, 64, 256, 512]) {
    scenarios.push({
      name: `blob ${kb}KB`,
      schema: widget,
      data: { blob: new Uint8Array(kb * 1024) },
      iterations: kb > 256 ? SCALE : SCALE * 4,
    });
  }

  // List of blobs (many base64-encoded chunks)
  for (const [totalKB, chunkKB] of [[1024, 8] as const]) {
    const count = (totalKB / chunkKB) | 0;
    scenarios.push({
      name: `list<blob> ${totalKB}KB (${chunkKB}KB×${count})`,
      schema: listBlobSchema,
      data: { items: Array.from({ length: count }, () => new Uint8Array(chunkKB * 1024)) },
      iterations: SCALE,
    });
  }

  return scenarios;
}

// ─── Benchmark runner (single variant) ───────────────────────────────────────

interface BenchResult {
  name: string;
  ms: number;
  kbPerMs: number;
  size: number;
}

function runVariant(variant: "multipass" | "byte"): BenchResult[] {
  const settings = {
    jsonName: true,
    timestampFormat: { default: 7 satisfies TimestampEpochSecondsSchema, useTrait: true },
  } as const;

  const serializer = variant === "multipass" ? new JsonShapeSerializer(settings) : new JsonShapeSerializer2(settings);

  const scenarios = getScenarios();
  const results: BenchResult[] = [];

  for (const { name, schema, data, iterations } of scenarios) {
    // Warmup
    for (let i = 0; i < Math.min(iterations, 50); i++) {
      serializer.write(schema, data);
      const r = serializer.flush();
      if (typeof r === "string") Buffer.from(r, "utf8");
    }

    // Measure: include Buffer.from() for string output to capture full wire-ready cost.
    const start = performance.now();
    let size = 0;
    for (let i = 0; i < iterations; i++) {
      serializer.write(schema, data);
      const r = serializer.flush();
      if (typeof r === "string") {
        const buf = Buffer.from(r, "utf8");
        size = buf.byteLength;
      } else {
        size = r.byteLength;
      }
    }
    const elapsed = performance.now() - start;
    const kbPerMs = (size * iterations) / 1024 / elapsed;

    results.push({ name, ms: elapsed / iterations, kbPerMs, size });
  }

  return results;
}

// ─── Deserialization benchmark runner ────────────────────────────────────────

type DeserVariant = "deser-original" | "deser-buffer" | "deser-buffer-bytes";

async function runDeserVariant(variant: DeserVariant): Promise<BenchResult[]> {
  const settings = {
    jsonName: true,
    timestampFormat: { default: 7 satisfies TimestampEpochSecondsSchema, useTrait: true },
  } as const;

  const serializer = new JsonShapeSerializer(settings);
  serializer.setSerdeContext({
    base64Encoder: (input: Uint8Array) => Buffer.from(input).toString("base64"),
  } as any);

  const deserializer =
    variant === "deser-original" ? new JsonShapeDeserializer(settings) : new JsonShapeDeserializer2(settings);

  const useBytes = variant === "deser-buffer-bytes";
  const encoder = new TextEncoder();

  const scenarios = getDeserScenarios();
  const results: BenchResult[] = [];

  for (const { name, schema, data, iterations } of scenarios) {
    // Serialize to JSON string (and optionally bytes) for deserialization input.
    serializer.write(schema, data);
    const jsonString = serializer.flush() as string;
    const jsonBytes = useBytes ? encoder.encode(jsonString) : undefined;
    const size = jsonString.length;

    const input: string | Uint8Array = useBytes ? jsonBytes! : jsonString;

    // Warmup
    for (let i = 0; i < Math.min(iterations, 50); ++i) {
      await deserializer.read(schema, input);
    }

    // Measure
    const start = performance.now();
    for (let i = 0; i < iterations; ++i) {
      await deserializer.read(schema, input);
    }
    const elapsed = performance.now() - start;
    const kbPerMs = (size * iterations) / 1024 / elapsed;

    results.push({ name, ms: elapsed / iterations, kbPerMs, size });
  }

  return results;
}

function getDeserScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];

  for (const depth of [4, 16, 64, 256, 1024]) {
    scenarios.push({
      name: `nested-struct (depth=${depth})`,
      schema: nestingWidget,
      data: createNestingWidget(depth),
      iterations: depth > 256 ? SCALE : SCALE * 4,
    });
  }

  for (const depth of [16, 64, 256, 1024]) {
    scenarios.push({
      name: `no-blob nested (depth=${depth})`,
      schema: noBlobWidget,
      data: createNoBlobWidget(depth),
      iterations: depth > 256 ? SCALE : SCALE * 4,
    });
  }

  for (const keys of [100, 500, 1000, 5000, 10000]) {
    scenarios.push({
      name: `wide-map (keys=${keys})`,
      schema: wideMapSchema,
      data: createWideMap(keys),
      iterations: keys > 5000 ? SCALE : SCALE * 2,
    });
  }

  scenarios.push({
    name: "small struct (widget)",
    schema: widget,
    data: {
      timestamp: new Date(0),
      bigint: 10000000000000000000000054321n,
      bigdecimal: new NumericValue("0.10000000000000000000000054321", "bigDecimal"),
      blob: new Uint8Array([0, 0, 0, 1]),
    },
    iterations: SCALE * 80,
  });

  // String-heavy / numeric-heavy cases (JSON2 regression candidates)
  for (const count of [1000, 5000, 30000]) {
    scenarios.push({
      name: `list<string> (n=${count})`,
      schema: listStringSchema,
      data: { items: createListString(count) },
      iterations: count > 5000 ? SCALE : SCALE * 2,
    });
  }

  for (const count of [1000, 10000, 30000]) {
    scenarios.push({
      name: `list<float> (n=${count})`,
      schema: listFloatSchema,
      data: { items: createListFloat(count) },
      iterations: count > 10000 ? SCALE : SCALE * 2,
    });
  }

  for (const count of [500, 2000, 5000]) {
    scenarios.push({
      name: `map<str,str> (n=${count})`,
      schema: mapStringStringSchema,
      data: createMapStringString(count),
      iterations: count > 2000 ? SCALE : SCALE * 2,
    });
  }

  // List of blobs (many base64-encoded chunks)
  for (const [totalKB, chunkKB] of [[1024, 8] as const]) {
    const count = (totalKB / chunkKB) | 0;
    scenarios.push({
      name: `list<blob> ${totalKB}KB (${chunkKB}KB×${count})`,
      schema: listBlobSchema,
      data: { items: Array.from({ length: count }, () => new Uint8Array(chunkKB * 1024)) },
      iterations: SCALE,
    });
  }

  return scenarios;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const variantArg = process.argv.find((a) => a.startsWith("--variant="));

if (variantArg) {
  // Child process mode: run one variant, output JSON
  const variant = variantArg.split("=")[1] as string;
  if (variant.startsWith("deser-")) {
    runDeserVariant(variant as DeserVariant).then((results) => {
      process.stdout.write(JSON.stringify(results));
    });
  } else {
    const results = runVariant(variant as "multipass" | "byte");
    process.stdout.write(JSON.stringify(results));
  }
} else {
  // Orchestrator: spawn child processes for each variant
  const scriptPath = __filename;

  function runChild(variant: string): BenchResult[] {
    const output = execFileSync(process.execPath, ["--import", "tsx", scriptPath, `--variant=${variant}`], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(output.trim());
  }

  const col = (s: string, w: number) => s.padEnd(w);
  const colR = (s: string, w: number) => s.padStart(w);

  // ─── Serializer benchmark ───────────────────────────────────────────────────

  console.log("JSON Shape Serializer Benchmark (isolated processes)");
  console.log("═".repeat(90));
  console.log();

  process.stdout.write("Running multipass serializer... ");
  const multipassResults = runChild("multipass");
  console.log("done.");

  process.stdout.write("Running byte serializer...      ");
  const byteResults = runChild("byte");
  console.log("done.");
  console.log();

  // Print serializer table
  const serHeader = `${col("Scenario", 30)} │ ${colR("Size", 8)} │ ${colR("Multipass", 12)} │ ${colR("Byte", 12)} │ ${colR("Δ", 8)}`;
  console.log(serHeader);
  console.log(
    "─".repeat(30) + "─┼─" + "─".repeat(8) + "─┼─" + "─".repeat(12) + "─┼─" + "─".repeat(12) + "─┼─" + "─".repeat(8)
  );

  for (let i = 0; i < multipassResults.length; i++) {
    const mp = multipassResults[i];
    const bp = byteResults[i];
    const size = mp.size < 1024 ? `${mp.size} B` : `${(mp.size / 1024).toFixed(1)} KB`;
    const speedup = ((mp.ms - bp.ms) / mp.ms) * 100;
    const delta = `${speedup > 0 ? "+" : ""}${speedup.toFixed(1)}%`;
    console.log(
      `${col(mp.name, 30)} │ ${colR(size, 8)} │ ${colR(`${mp.kbPerMs.toFixed(1)} kb/ms`, 12)} │ ${colR(`${bp.kbPerMs.toFixed(1)} kb/ms`, 12)} │ ${colR(delta, 8)}`
    );
  }

  console.log();
  console.log("Δ = byte serializer speed improvement over multipass (positive = faster)");

  // ─── Deserializer benchmark ─────────────────────────────────────────────────

  console.log();
  console.log();
  console.log("JSON Shape Deserializer Benchmark (isolated processes)");
  console.log("═".repeat(100));
  console.log();

  process.stdout.write("Running original deserializer (string)...       ");
  const deserOriginalResults = runChild("deser-original");
  console.log("done.");

  process.stdout.write("Running buffer deserializer (string)...         ");
  const deserBufferResults = runChild("deser-buffer");
  console.log("done.");

  process.stdout.write("Running buffer deserializer (Uint8Array)...     ");
  const deserBufferBytesResults = runChild("deser-buffer-bytes");
  console.log("done.");
  console.log();

  // Print deserializer table
  const deserHeader = `${col("Scenario", 30)} │ ${colR("Size", 8)} │ ${colR("Original", 12)} │ ${colR("Buffer", 12)} │ ${colR("Buf+Bytes", 12)} │ ${colR("Δ str", 8)} │ ${colR("Δ bytes", 8)}`;
  console.log(deserHeader);
  console.log(
    "─".repeat(30) +
      "─┼─" +
      "─".repeat(8) +
      "─┼─" +
      "─".repeat(12) +
      "─┼─" +
      "─".repeat(12) +
      "─┼─" +
      "─".repeat(12) +
      "─┼─" +
      "─".repeat(8) +
      "─┼─" +
      "─".repeat(8)
  );

  for (let i = 0; i < deserOriginalResults.length; i++) {
    const orig = deserOriginalResults[i];
    const mut = deserBufferResults[i];
    const mutB = deserBufferBytesResults[i];
    const size = orig.size < 1024 ? `${orig.size} B` : `${(orig.size / 1024).toFixed(1)} KB`;
    const strSpeedup = ((orig.ms - mut.ms) / orig.ms) * 100;
    const bytesSpeedup = ((orig.ms - mutB.ms) / orig.ms) * 100;
    const deltaStr = `${strSpeedup > 0 ? "+" : ""}${strSpeedup.toFixed(1)}%`;
    const deltaBytes = `${bytesSpeedup > 0 ? "+" : ""}${bytesSpeedup.toFixed(1)}%`;
    console.log(
      `${col(orig.name, 30)} │ ${colR(size, 8)} │ ${colR(`${orig.kbPerMs.toFixed(1)} kb/ms`, 12)} │ ${colR(`${mut.kbPerMs.toFixed(1)} kb/ms`, 12)} │ ${colR(`${mutB.kbPerMs.toFixed(1)} kb/ms`, 12)} │ ${colR(deltaStr, 8)} │ ${colR(deltaBytes, 8)}`
    );
  }

  console.log();
  console.log("Δ str   = buffer (string input) speed improvement over original (positive = faster)");
  console.log("Δ bytes = buffer (Uint8Array input) speed improvement over original (positive = faster)");
}
