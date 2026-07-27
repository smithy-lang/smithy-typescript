/**
 * Benchmark: CBOR shape serde vs JSON shape serde.
 *
 * Each variant runs in its own child process (this script re-invokes itself
 * with --variant=X) to avoid JIT/GC contamination between variants.
 *
 * Usage:
 *   node scripts/cbor-shape-perf.mjs
 *   node scripts/cbor-shape-perf.mjs --variant=cbor-ser
 *   node scripts/cbor-shape-perf.mjs --variant=json-ser
 *   node scripts/cbor-shape-perf.mjs --variant=cbor-de
 *   node scripts/cbor-shape-perf.mjs --variant=json-de
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { JsonCodec } from "@aws-sdk/core/protocols";
import { cbor, CborShapeDeserializer, CborShapeSerializer } from "@smithy/core/cbor";

// ─── Constants ───────────────────────────────────────────────────────────────

const DATA_SCALAR = 5;
const SCALE = (3 * 100) / DATA_SCALAR;
const WARMUP = 50;

// ─── Schemas ─────────────────────────────────────────────────────────────────

const listStringSchema = [1, "ns", "L", 0, 0];
const listFloatSchema = [1, "ns", "L", 0, 1];
const listIntSchema = [1, "ns", "L", 0, 1];
const listLongIntSchema = [1, "ns", "L", 0, 1];
const mapStringStringSchema = [2, "ns", "M", 0, 0, 0];
const mapStringLongIntSchema = [2, "ns", "M", 0, 0, 1];

const putMetricDataLikeSchema = [
  1,
  "ns",
  "L",
  0,
  [
    3,
    "ns",
    "MetricDatum",
    0,
    ["MetricData", "Namespace"],
    [
      [
        1,
        "ns",
        "MD",
        0,
        [
          3,
          "ns",
          "Inner",
          0,
          ["MetricName", "Dimensions", "Unit", "Value"],
          [0, [1, "ns", "DL", 0, [3, "ns", "D", 0, ["Name", "Value"], [0, 0]]], 0, 1],
        ],
      ],
      0,
    ],
  ],
];

const putMetricDataRealisticSchema = [
  1,
  "ns",
  "ReqList",
  0,
  [
    3,
    "ns",
    "PutMetricDataInput",
    0,
    ["Namespace", "MetricData"],
    [
      0,
      [
        1,
        "ns",
        "MetricDataList",
        0,
        [
          3,
          "ns",
          "MetricDatum",
          0,
          ["MetricName", "Dimensions", "Timestamp", "Value", "Unit", "StatisticValues"],
          [
            0,
            [1, "ns", "DimList", 0, [3, "ns", "Dim", 0, ["Name", "Value"], [0, 0]]],
            1,
            1,
            0,
            [3, "ns", "Stats", 0, ["SampleCount", "Sum", "Minimum", "Maximum"], [1, 1, 1, 1]],
          ],
        ],
      ],
    ],
  ],
];

const nonAsciiSchema = [
  1,
  "ns",
  "L",
  0,
  [
    3,
    "ns",
    "S",
    0,
    ["メトリック名", "ディメンション", "単位", "数値", "名前空間"],
    [0, [1, "ns", "DL", 0, [3, "ns", "D", 0, ["名前", "値"], [0, 0]]], 0, 1, 0],
  ],
];

const blobStructSchema = [1, "ns", "L", 0, [3, "ns", "BlobStruct", 0, ["id", "data", "name"], [0, 21, 0]]];

const timestampStructSchema = [1, "ns", "L", 0, [3, "ns", "TsStruct", 0, ["id", "createdAt", "value"], [0, 4, 1]]];

// ─── Data generators ─────────────────────────────────────────────────────────

function createListString() {
  const l = [];
  for (let i = 0; i < 900 * DATA_SCALAR; ++i) l[i] = "string".repeat((Math.random() * 35) | 0);
  return l;
}

function createListFloat() {
  const l = [];
  for (let i = 0; i < 6000 * DATA_SCALAR; ++i) l[i] = Math.random() * 3.4e38;
  return l;
}

function createListInt() {
  const l = [];
  for (let i = 0; i < 17000 * DATA_SCALAR; ++i) l[i] = ((Math.random() * 20000) | 0) - 10000;
  return l;
}

function createListLongInt() {
  const l = [];
  for (let i = 0; i < 10000 * DATA_SCALAR; ++i) l[i] = Math.floor(Math.random() * 0x7fffffff * 2 - 0x7fffffff);
  return l;
}

function createMapStringString() {
  const m = {};
  for (let i = 0; i < 324 * DATA_SCALAR; ++i)
    m["key".repeat((Math.random() * 10) | 0) + i] = "key".repeat((Math.random() * 155) | 0) + i + Math.random();
  return m;
}

function createMapStringLongInt() {
  const m = {};
  for (let i = 0; i < 324 * DATA_SCALAR; ++i)
    m["key".repeat((Math.random() * 10) | 0) + i] = Math.floor(Math.random() * 0x7fffffff * 2 - 0x7fffffff);
  return m;
}

function createPutMetricDataLike() {
  const c = [];
  for (let i = 0; i < 600 * DATA_SCALAR; ++i)
    c[i] = {
      MetricData: [
        {
          MetricName: "PAGES_VISITED",
          Dimensions: [{ Name: "UNIQUE_PAGES", Value: "URLS" }],
          Unit: "None",
          Value: 1.0,
        },
      ],
      Namespace: "SITE/TRAFFIC",
    };
  return c;
}

function createPutMetricDataRealistic() {
  const req = {
    Namespace: "MyApp/Production",
    MetricData: Array.from({ length: 20 }, (_, i) => ({
      MetricName: "RequestLatency_" + (i % 5),
      Dimensions: [
        { Name: "Environment", Value: "prod" },
        { Name: "Region", Value: "us-east-1" },
        { Name: "ServiceName", Value: "AuthService" },
      ],
      Timestamp: 1718000000 + i,
      Value: Math.random() * 500,
      Unit: "Milliseconds",
      ...(i % 3 === 0 ? { StatisticValues: { SampleCount: 100, Sum: 4500.0 + i, Minimum: 1.2, Maximum: 89.5 } } : {}),
    })),
  };
  const c = [];
  for (let i = 0; i < 80 * DATA_SCALAR; ++i) c[i] = req;
  return c;
}

function createNonAsciiStructs() {
  const c = [];
  for (let i = 0; i < 600 * DATA_SCALAR; ++i)
    c[i] = {
      メトリック名: "PAGES_VISITED",
      ディメンション: [{ 名前: "UNIQUE_PAGES", 値: "URLS" }],
      単位: "None",
      数値: 1.0,
      名前空間: "SITE/TRAFFIC",
    };
  return c;
}

function createBlobStructs() {
  const c = [];
  for (let i = 0; i < 500 * DATA_SCALAR; ++i) {
    const d = new Uint8Array(64);
    for (let j = 0; j < 64; ++j) d[j] = (Math.random() * 256) | 0;
    c[i] = { id: "item-" + i, data: d, name: "blob-entry-" + i };
  }
  return c;
}

function createTimestampStructs() {
  const c = [];
  for (let i = 0; i < 1000 * DATA_SCALAR; ++i)
    c[i] = { id: "event-" + i, createdAt: new Date(1700000000000 + i * 1000), value: Math.random() * 100 };
  return c;
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

function getScenarios() {
  return [
    { name: "list<string(0,180)>", schema: listStringSchema, data: createListString() },
    { name: "list<float>", schema: listFloatSchema, data: createListFloat() },
    { name: "list<int>", schema: listIntSchema, data: createListInt() },
    { name: "list<long int>", schema: listLongIntSchema, data: createListLongInt() },
    { name: "map<string, string>", schema: mapStringStringSchema, data: createMapStringString() },
    { name: "map<string, long int>", schema: mapStringLongIntSchema, data: createMapStringLongInt() },
    { name: "list<struct> PutMetricData-like", schema: putMetricDataLikeSchema, data: createPutMetricDataLike() },
    {
      name: "struct PutMetricData realistic",
      schema: putMetricDataRealisticSchema,
      data: createPutMetricDataRealistic(),
    },
    { name: "list<struct> non-ASCII keys", schema: nonAsciiSchema, data: createNonAsciiStructs() },
    { name: "list<struct> with blobs", schema: blobStructSchema, data: createBlobStructs() },
    { name: "list<struct> with timestamps", schema: timestampStructSchema, data: createTimestampStructs() },
  ];
}

// ─── Benchmark runner ────────────────────────────────────────────────────────

function runVariant(variant) {
  cbor.resizeEncodingBuffer(10_000_000);

  const jsonCodec = new JsonCodec({ jsonName: false, timestampFormat: { useTrait: true, default: 7 } });
  const scenarios = getScenarios();
  const results = [];

  for (const { name, schema, data } of scenarios) {
    switch (variant) {
      case "cbor-ser": {
        const serializer = new CborShapeSerializer();
        for (let i = 0; i < WARMUP; ++i) {
          serializer.write(schema, data);
          serializer.flush();
        }

        const start = performance.now();
        let bytes = 0;
        for (let i = 0; i < SCALE; ++i) {
          serializer.write(schema, data);
          bytes = serializer.flush().byteLength;
        }
        results.push({ name, ms: performance.now() - start, bytes });
        break;
      }
      case "json-ser": {
        const serializer = jsonCodec.createSerializer();
        for (let i = 0; i < WARMUP; ++i) {
          serializer.write(schema, data);
          serializer.flush();
        }

        const start = performance.now();
        let bytes = 0;
        for (let i = 0; i < SCALE; ++i) {
          serializer.write(schema, data);
          const out = serializer.flush();
          const str = typeof out === "string" ? out : JSON.stringify(out);
          bytes = Buffer.byteLength(str);
        }
        results.push({ name, ms: performance.now() - start, bytes });
        break;
      }
      case "cbor-de": {
        const ser = new CborShapeSerializer();
        ser.write(schema, data);
        const cborBytes = ser.flush();
        const bytes = cborBytes.byteLength;

        const deserializer = new CborShapeDeserializer();
        for (let i = 0; i < WARMUP; ++i) {
          deserializer.read(schema, cborBytes);
        }

        const start = performance.now();
        for (let i = 0; i < SCALE; ++i) {
          deserializer.read(schema, cborBytes);
        }
        results.push({ name, ms: performance.now() - start, bytes });
        break;
      }
      case "json-de": {
        const serializer = jsonCodec.createSerializer();
        serializer.write(schema, data);
        const out = serializer.flush();
        const jsonStr = typeof out === "string" ? out : JSON.stringify(out);
        const bytes = Buffer.byteLength(jsonStr);

        const deserializer = jsonCodec.createDeserializer();
        for (let i = 0; i < WARMUP; ++i) {
          deserializer.read(schema, jsonStr);
        }

        const start = performance.now();
        for (let i = 0; i < SCALE; ++i) {
          deserializer.read(schema, jsonStr);
        }
        results.push({ name, ms: performance.now() - start, bytes });
        break;
      }
    }
  }

  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const variantArg = process.argv.find((a) => a.startsWith("--variant="));

if (variantArg) {
  const variant = variantArg.split("=")[1];
  process.stdout.write(JSON.stringify(runVariant(variant)));
} else {
  const scriptPath = fileURLToPath(import.meta.url);

  function runChild(variant) {
    const output = execFileSync(process.execPath, [scriptPath, `--variant=${variant}`], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(output.trim());
  }

  console.log("# CBOR vs JSON Shape Serde Benchmark");
  console.log(`\nRepetitions per test: ${SCALE}, warmup: ${WARMUP}`);
  console.log("");

  // ─── Serialization ──────────────────────────────────────────────────────────

  process.stdout.write("CBOR ser...");
  const cborSerResults = runChild("cbor-ser");
  console.log("done.");

  process.stdout.write("JSON ser...");
  const jsonSerResults = runChild("json-ser");
  console.log("done.");

  console.log();
  console.log("## Serialization Results\n");
  console.log(
    mdTable(
      ["Test Case", "CBOR Size", "JSON Size", "CBOR ms", "JSON ms", "CBOR/JSON"],
      getScenarios().map((_, i) => {
        const cb = cborSerResults[i],
          js = jsonSerResults[i];
        return [
          "`" + cb.name + "`",
          fmtSize(cb.bytes),
          fmtSize(js.bytes),
          cb.ms.toFixed(0) + " ms",
          js.ms.toFixed(0) + " ms",
          (cb.ms / js.ms).toFixed(2) + "x",
        ];
      })
    )
  );

  // ─── Deserialization ────────────────────────────────────────────────────────

  console.log();

  process.stdout.write("CBOR de...");
  const cborDeResults = runChild("cbor-de");
  console.log("done.");

  process.stdout.write("JSON de...");
  const jsonDeResults = runChild("json-de");
  console.log("done.");

  console.log();
  console.log("## Deserialization Results\n");
  console.log(
    mdTable(
      ["Test Case", "CBOR Size", "JSON Size", "CBOR ms", "JSON ms", "CBOR/JSON"],
      getScenarios().map((_, i) => {
        const cb = cborDeResults[i],
          js = jsonDeResults[i];
        return [
          "`" + cb.name + "`",
          fmtSize(cb.bytes),
          fmtSize(js.bytes),
          cb.ms.toFixed(0) + " ms",
          js.ms.toFixed(0) + " ms",
          (cb.ms / js.ms).toFixed(2) + "x",
        ];
      })
    )
  );
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  return bytes < 1e6 ? (bytes / 1e3).toFixed(0) + " kb" : (bytes / 1e6).toFixed(1) + " mb";
}

function mdTable(headers, rows) {
  const cols = headers.map((h, i) => {
    const max = Math.max(h.length, ...rows.map((r) => String(r[i]).length));
    return { width: max, align: i === 0 ? "l" : "r" };
  });
  const pad = (s, i) => {
    const diff = cols[i].width - s.length;
    return cols[i].align === "r" ? " ".repeat(diff) + s : s + " ".repeat(diff);
  };
  const line = (cells) => "| " + cells.map((c, i) => pad(c, i)).join(" | ") + " |";
  const sep =
    "| " + cols.map((c) => (c.align === "r" ? "-".repeat(c.width - 1) + ":" : "-".repeat(c.width))).join(" | ") + " |";
  return [line(headers), sep, ...rows.map((r) => line(r))].join("\n");
}
