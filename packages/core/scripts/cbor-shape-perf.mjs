/**
 * Benchmark comparing:
 *   - Multi-pass CborShapeSerializer (schema walk → intermediate object → cbor.serialize)
 *   - Single-pass SinglePassCborShapeSerializer (schema walk → direct byte output)
 *   - JsonShapeSerializer from @aws-sdk/core/protocols (schema walk → object → JSON.stringify)
 *
 * Usage: node ./scripts/cbor-shape-perf.mjs
 * Run from packages/core directory after building (npx tsc --project tsconfig.cjs.json).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreDir = resolve(__dirname, "..");
const workerPath = resolve(coreDir, ".cbor-shape-perf-worker.cjs");

const cborRequire = `require(${JSON.stringify(resolve(coreDir, "dist-cjs/submodules/cbor/index.js"))})`;
const schemaRequire = `require(${JSON.stringify(resolve(coreDir, "dist-cjs/submodules/schema/index.js"))})`;
const jsonProtocolsRequire = `require("@aws-sdk/core/protocols")`;

const DATA_SCALAR = 5;
const SCALE = (3 * 100) / DATA_SCALAR;

/**
 * Test definitions.
 */
const testDefs = [
  {
    name: "list<string(0,180)>",
    schema: `[1, "ns", "L", 0, 0]`,
    gen: `(() => { const l=[]; for(let i=0;i<900*${DATA_SCALAR};++i) l[i]="string".repeat((Math.random()*35)|0); return l; })()`,
  },
  {
    name: "list<float>",
    schema: `[1, "ns", "L", 0, 1]`,
    gen: `(() => { const l=[]; for(let i=0;i<6000*${DATA_SCALAR};++i) l[i]=Math.random()*3.4e38; return l; })()`,
  },
  {
    name: "list<int>",
    schema: `[1, "ns", "L", 0, 1]`,
    gen: `(() => { const l=[]; for(let i=0;i<17000*${DATA_SCALAR};++i) l[i]=((Math.random()*20000)|0)-10000; return l; })()`,
  },
  {
    name: "list<long int>",
    schema: `[1, "ns", "L", 0, 1]`,
    gen: `(() => { const l=[]; for(let i=0;i<10000*${DATA_SCALAR};++i) l[i]=Math.floor(Math.random()*0x7fffffff*2-0x7fffffff); return l; })()`,
  },
  {
    name: "map<string, string>",
    schema: `[2, "ns", "M", 0, 0, 0]`,
    gen: `(() => { const m={}; for(let i=0;i<324*${DATA_SCALAR};++i) m["key".repeat((Math.random()*10)|0)+i]="key".repeat((Math.random()*155)|0)+i+Math.random(); return m; })()`,
  },
  {
    name: "map<string, long int>",
    schema: `[2, "ns", "M", 0, 0, 1]`,
    gen: `(() => { const m={}; for(let i=0;i<324*${DATA_SCALAR};++i) m["key".repeat((Math.random()*10)|0)+i]=Math.floor(Math.random()*0x7fffffff*2-0x7fffffff); return m; })()`,
  },
  {
    name: "list<struct> PutMetricData-like",
    schema: `[1, "ns", "L", 0,
      [3, "ns", "MetricDatum", 0,
        ["MetricData", "Namespace"],
        [
          [1, "ns", "MD", 0,
            [3, "ns", "Inner", 0,
              ["MetricName", "Dimensions", "Unit", "Value"],
              [0, [1, "ns", "DL", 0, [3, "ns", "D", 0, ["Name", "Value"], [0, 0]]], 0, 1]
            ]
          ],
          0
        ]
      ]
    ]`,
    gen: `(() => { const c=[]; for(let i=0;i<600*${DATA_SCALAR};++i) c[i]={MetricData:[{MetricName:"PAGES_VISITED",Dimensions:[{Name:"UNIQUE_PAGES",Value:"URLS"}],Unit:"None",Value:1.0}],Namespace:"SITE/TRAFFIC"}; return c; })()`,
  },
  {
    name: "struct PutMetricData realistic",
    schema: `[1, "ns", "ReqList", 0,
      [3, "ns", "PutMetricDataInput", 0,
        ["Namespace", "MetricData"],
        [0,
          [1, "ns", "MetricDataList", 0,
            [3, "ns", "MetricDatum", 0,
              ["MetricName", "Dimensions", "Timestamp", "Value", "Unit", "StatisticValues"],
              [0,
                [1, "ns", "DimList", 0, [3, "ns", "Dim", 0, ["Name", "Value"], [0, 0]]],
                1,
                1,
                0,
                [3, "ns", "Stats", 0, ["SampleCount", "Sum", "Minimum", "Maximum"], [1, 1, 1, 1]]
              ]
            ]
          ]
        ]
      ]
    ]`,
    gen: `(() => {
      const req = {Namespace:"MyApp/Production",MetricData:Array.from({length:20},(_,i)=>({MetricName:"RequestLatency_"+(i%5),Dimensions:[{Name:"Environment",Value:"prod"},{Name:"Region",Value:"us-east-1"},{Name:"ServiceName",Value:"AuthService"}],Timestamp:1718000000+i,Value:Math.random()*500,Unit:"Milliseconds",...(i%3===0?{StatisticValues:{SampleCount:100,Sum:4500.0+i,Minimum:1.2,Maximum:89.5}}:{})}))};
      const c=[]; for(let i=0;i<80*${DATA_SCALAR};++i) c[i]=req; return c;
    })()`,
  },
  {
    name: "list<struct> non-ASCII keys",
    schema: `[1, "ns", "L", 0,
      [3, "ns", "S", 0,
        ["メトリック名", "ディメンション", "単位", "数値", "名前空間"],
        [0, [1, "ns", "DL", 0, [3, "ns", "D", 0, ["名前", "値"], [0, 0]]], 0, 1, 0]
      ]
    ]`,
    gen: `(() => { const c=[]; for(let i=0;i<600*${DATA_SCALAR};++i) c[i]={"メトリック名":"PAGES_VISITED","ディメンション":[{"名前":"UNIQUE_PAGES","値":"URLS"}],"単位":"None","数値":1.0,"名前空間":"SITE/TRAFFIC"}; return c; })()`,
  },
  {
    name: "list<struct> with blobs",
    schema: `[1, "ns", "L", 0,
      [3, "ns", "BlobStruct", 0,
        ["id", "data", "name"],
        [0, 21, 0]
      ]
    ]`,
    gen: `(() => { const c=[]; for(let i=0;i<500*${DATA_SCALAR};++i) { const d = new Uint8Array(64); for(let j=0;j<64;++j) d[j]=(Math.random()*256)|0; c[i]={id:"item-"+i,data:d,name:"blob-entry-"+i}; } return c; })()`,
  },
  {
    name: "list<struct> with timestamps",
    schema: `[1, "ns", "L", 0,
      [3, "ns", "TsStruct", 0,
        ["id", "createdAt", "value"],
        [0, 4, 1]
      ]
    ]`,
    gen: `(() => { const c=[]; for(let i=0;i<1000*${DATA_SCALAR};++i) c[i]={id:"event-"+i,createdAt:new Date(1700000000000+i*1000),value:Math.random()*100}; return c; })()`,
  },
];

/**
 * @param {number} testIdx
 * @param {"multi-ser"|"single-ser"|"json-ser"|"multi-de"|"single-de"} phase
 */
function runPhase(testIdx, phase) {
  const t = testDefs[testIdx];

  let script;

  if (phase === "json-ser") {
    script = `
const { JsonCodec } = ${jsonProtocolsRequire};
const { NormalizedSchema } = ${schemaRequire};

const SCALE = ${SCALE};
const schema = ${t.schema};
const data = ${t.gen};

const codec = new JsonCodec({ jsonName: false, timestampFormat: { useTrait: true, default: 7 } });
const serializer = codec.createSerializer();

// Warm up
for (let i = 0; i < 50; ++i) {
  serializer.write(schema, data);
  serializer.flush();
}

const a = performance.now();
let lastStr;
for (let i = 0; i < SCALE; ++i) {
  serializer.write(schema, data);
  const out = serializer.flush();
  lastStr = typeof out === "string" ? out : JSON.stringify(out);
}
const ms = performance.now() - a;
const bytes = Buffer.byteLength(lastStr);
console.log(JSON.stringify({ ms, bytes }));
`;
  } else if (phase === "json-de") {
    script = `
const { JsonCodec } = ${jsonProtocolsRequire};
const { NormalizedSchema } = ${schemaRequire};

const SCALE = ${SCALE};
const schema = ${t.schema};
const data = ${t.gen};

const codec = new JsonCodec({ jsonName: false, timestampFormat: { useTrait: true, default: 7 } });
const serializer = codec.createSerializer();
const deserializer = codec.createDeserializer();

// Serialize to JSON string first.
serializer.write(schema, data);
const out = serializer.flush();
const jsonStr = typeof out === "string" ? out : JSON.stringify(out);
const bytes = Buffer.byteLength(jsonStr);

// Deserialize: JSON.parse + schema transform (synchronous path).
const parsed = JSON.parse(jsonStr);

// Warm up
for (let i = 0; i < 50; ++i) {
  deserializer.readObject(schema, JSON.parse(jsonStr));
}

const a = performance.now();
for (let i = 0; i < SCALE; ++i) {
  const parsed = JSON.parse(jsonStr);
  deserializer.readObject(schema, parsed);
}
const ms = performance.now() - a;
console.log(JSON.stringify({ ms, bytes }));
`;
  } else {
    const isSer = phase.endsWith("ser");
    const isSingle = phase.startsWith("single");

    script = `
const { CborShapeSerializer, CborShapeDeserializer, SinglePassCborShapeSerializer, SinglePassCborShapeDeserializer, cbor } = ${cborRequire};
const { NormalizedSchema } = ${schemaRequire};

cbor.resizeEncodingBuffer(10_000_000);

const SCALE = ${SCALE};
const schema = ${t.schema};
const data = ${t.gen};

${
  isSer
    ? `
const serializer = new ${isSingle ? "SinglePassCborShapeSerializer" : "CborShapeSerializer"}();

// Warm up
for (let i = 0; i < 50; ++i) {
  serializer.write(schema, data);
  serializer.flush();
}

const a = performance.now();
let bytes = 0;
for (let i = 0; i < SCALE; ++i) {
  serializer.write(schema, data);
  const buf = serializer.flush();
  bytes = buf.byteLength;
}
const ms = performance.now() - a;
console.log(JSON.stringify({ ms, bytes }));
`
    : `
// Deserialization benchmark
const serializer = new SinglePassCborShapeSerializer();
serializer.write(schema, data);
const cborBytes = serializer.flush();
const bytes = cborBytes.byteLength;

const deserializer = new ${isSingle ? "SinglePassCborShapeDeserializer" : "CborShapeDeserializer"}();

// Warm up
for (let i = 0; i < 50; ++i) {
  deserializer.read(schema, cborBytes);
}

const a = performance.now();
for (let i = 0; i < SCALE; ++i) {
  deserializer.read(schema, cborBytes);
}
const ms = performance.now() - a;
console.log(JSON.stringify({ ms, bytes }));
`
}
`;
  }

  writeFileSync(workerPath, script);
  const result = execFileSync("node", [workerPath], {
    cwd: coreDir,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return JSON.parse(result.trim());
}

function mdTable(headers, rows) {
  const cols = headers.map((h, i) => {
    const max = Math.max(h.length, ...rows.map((r) => String(r[i]).length));
    return { width: max, align: i === 0 ? "l" : "r" };
  });
  const pad = (s, i) => {
    const str = String(s);
    const diff = cols[i].width - str.length;
    return cols[i].align === "r" ? " ".repeat(diff) + str : str + " ".repeat(diff);
  };
  const line = (cells) => "| " + cells.map((c, i) => pad(c, i)).join(" | ") + " |";
  const sep =
    "| " + cols.map((c) => (c.align === "r" ? "-".repeat(c.width - 1) + ":" : "-".repeat(c.width))).join(" | ") + " |";
  return [line(headers), sep, ...rows.map((r) => line(r))].join("\n");
}

// ─── Run benchmarks ───────────────────────────────────────────────────────────

console.log("# CBOR ShapeSerializer Benchmark: Multi-pass vs Single-pass vs JSON");
console.log(`\nRepetitions per test: ${SCALE}`);
console.log("");

// Serialization
process.stdout.write("CBOR multi-pass ser");
const multiSerResults = [];
for (let i = 0; i < testDefs.length; ++i) {
  process.stdout.write(".");
  multiSerResults.push(runPhase(i, "multi-ser"));
}

process.stdout.write("\nCBOR single-pass ser");
const singleSerResults = [];
for (let i = 0; i < testDefs.length; ++i) {
  process.stdout.write(".");
  singleSerResults.push(runPhase(i, "single-ser"));
}

process.stdout.write("\nJSON ser");
const jsonSerResults = [];
for (let i = 0; i < testDefs.length; ++i) {
  process.stdout.write(".");
  jsonSerResults.push(runPhase(i, "json-ser"));
}

// Deserialization
process.stdout.write("\nCBOR multi-pass de");
const multiDeResults = [];
for (let i = 0; i < testDefs.length; ++i) {
  process.stdout.write(".");
  multiDeResults.push(runPhase(i, "multi-de"));
}

process.stdout.write("\nCBOR single-pass de");
const singleDeResults = [];
for (let i = 0; i < testDefs.length; ++i) {
  process.stdout.write(".");
  singleDeResults.push(runPhase(i, "single-de"));
}

process.stdout.write("\nJSON de");
const jsonDeResults = [];
for (let i = 0; i < testDefs.length; ++i) {
  process.stdout.write(".");
  jsonDeResults.push(runPhase(i, "json-de"));
}

console.log("\n");

// ─── Format results ───────────────────────────────────────────────────────────

console.log("## Serialization Results\n");
const serHeaders = [
  "Test Case",
  "CBOR Size",
  "JSON Size",
  "CBOR multi ms",
  "CBOR single ms",
  "JSON ms",
  "Single vs Multi",
  "Single vs JSON",
];
const serRows = testDefs.map((t, i) => {
  const cborBytes = multiSerResults[i].bytes;
  const jsonBytes = jsonSerResults[i].bytes;
  const multiMs = multiSerResults[i].ms;
  const singleMs = singleSerResults[i].ms;
  const jsonMs = jsonSerResults[i].ms;
  return [
    "`" + t.name + "`",
    cborBytes < 1e6 ? (cborBytes / 1e3).toFixed(0) + " kb" : (cborBytes / 1e6).toFixed(1) + " mb",
    jsonBytes < 1e6 ? (jsonBytes / 1e3).toFixed(0) + " kb" : (jsonBytes / 1e6).toFixed(1) + " mb",
    multiMs.toFixed(0) + " ms",
    singleMs.toFixed(0) + " ms",
    jsonMs.toFixed(0) + " ms",
    (multiMs / singleMs).toFixed(2) + "x",
    (jsonMs / singleMs).toFixed(2) + "x",
  ];
});
console.log(mdTable(serHeaders, serRows));

console.log("\n## Deserialization Results\n");
const deHeaders = [
  "Test Case",
  "Data Size",
  "CBOR multi ms",
  "CBOR single ms",
  "JSON ms",
  "Single vs Multi",
  "Single vs JSON",
];
const deRows = testDefs.map((t, i) => {
  const bytes = multiDeResults[i].bytes;
  const multiMs = multiDeResults[i].ms;
  const singleMs = singleDeResults[i].ms;
  const jsonMs = jsonDeResults[i].ms;
  return [
    "`" + t.name + "`",
    bytes < 1e6 ? (bytes / 1e3).toFixed(0) + " kb" : (bytes / 1e6).toFixed(1) + " mb",
    multiMs.toFixed(0) + " ms",
    singleMs.toFixed(0) + " ms",
    jsonMs.toFixed(0) + " ms",
    (multiMs / singleMs).toFixed(2) + "x",
    (jsonMs / singleMs).toFixed(2) + "x",
  ];
});
console.log(mdTable(deHeaders, deRows));

try {
  unlinkSync(workerPath);
} catch {}
