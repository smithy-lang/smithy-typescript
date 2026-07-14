import { execFileSync, execSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreDir = resolve(__dirname, "..");
const baselineDir = resolve(__dirname, "baseline");
const workerPaths = {
  current: resolve(coreDir, ".cbor-perf-worker.cjs"),
  baseline: resolve(baselineDir, ".cbor-perf-worker.cjs"),
};

if (!existsSync(resolve(baselineDir, "node_modules"))) {
  console.log("Installing baseline dependencies...");
  execSync("npm install", { cwd: baselineDir, stdio: "inherit" });
}

const cborRequires = {
  current: `require(${JSON.stringify(resolve(coreDir, "dist-cjs/submodules/cbor/index.js"))})`,
  baseline: `require("@smithy/core/cbor")`,
};
const base64Requires = {
  current: `require(${JSON.stringify(resolve(coreDir, "dist-cjs/submodules/serde/index.js"))})`,
  baseline: `require("@smithy/core/serde")`,
};

const DATA_SCALAR = 5;
const SCALE = (3 * 100) / DATA_SCALAR;

const testDefs = [
  {
    name: "string",
    gen: `(() => { const b=[]; for(let i=0;i<3400*${DATA_SCALAR};++i) b[i]=Math.random()+""; return b.join("代码"); })()`,
  },
  {
    name: "list<string(0,180)>",
    gen: `(() => { const l=[]; for(let i=0;i<900*${DATA_SCALAR};++i) l[i]="string".repeat((Math.random()*35)|0); return l; })()`,
  },
  {
    name: "list<float>",
    gen: `(() => { const l=[]; for(let i=0;i<6000*${DATA_SCALAR};++i) l[i]=Math.random()*3.4e38; return l; })()`,
  },
  {
    name: "list<double>",
    gen: `(() => { const l=[]; for(let i=0;i<6000*${DATA_SCALAR};++i) l[i]=Math.random()*Number.MAX_VALUE; return l; })()`,
  },
  // {
  //   name: "byte[]",
  //   gen: `(() => { const l=new Uint8Array(${100000 * DATA_SCALAR}); for(let i=0;i<l.length;++i) l[i]=((Math.random()*20000)|0)%255; return l; })()`,
  // },
  {
    name: "list<int>",
    gen: `(() => { const l=[]; for(let i=0;i<17000*${DATA_SCALAR};++i) l[i]=((Math.random()*20000)|0)-10000; return l; })()`,
  },
  {
    name: "list<long int>",
    gen: `(() => { const l=[]; for(let i=0;i<10000*${DATA_SCALAR};++i) l[i]=Math.floor(Math.random()*0x7fffffff*2-0x7fffffff); return l; })()`,
  },
  {
    name: "list<long long int>",
    gen: `(() => { const l=[]; for(let i=0;i<10000*${DATA_SCALAR};++i) l[i]=Math.floor(-18446744073709551615+((Math.random()*2*18446744073709551615)|0)); return l; })()`,
  },
  {
    name: "map<string(0,30), string(0,450)>",
    gen: `(() => { const m={}; for(let i=0;i<324*${DATA_SCALAR};++i) m["key".repeat((Math.random()*10)|0)+i]="key".repeat((Math.random()*155)|0)+i+Math.random(); return m; })()`,
  },
  {
    name: "map<string(0,30), long int>",
    gen: `(() => { const m={}; for(let i=0;i<324*${DATA_SCALAR};++i) m["key".repeat((Math.random()*10)|0)+i]=Math.floor(Math.random()*0x7fffffff*2-0x7fffffff); return m; })()`,
  },
  {
    name: "list<struct> PutMetricData-like",
    gen: `(() => { const c=[]; for(let i=0;i<600*${DATA_SCALAR};++i) c[i]={MetricData:[{MetricName:"PAGES_VISITED",Dimensions:[{Name:"UNIQUE_PAGES",Value:"URLS"}],Unit:"None",Value:1.0}],Namespace:"SITE/TRAFFIC"}; return c; })()`,
  },
  {
    name: "struct PutMetricData realistic",
    gen: `(() => {
      const req = {Namespace:"MyApp/Production",MetricData:Array.from({length:20},(_,i)=>({MetricName:"RequestLatency_"+(i%5),Dimensions:[{Name:"Environment",Value:"prod"},{Name:"Region",Value:"us-east-1"},{Name:"ServiceName",Value:"AuthService"}],Timestamp:1718000000+i,Value:Math.random()*500,Unit:"Milliseconds",...(i%3===0?{StatisticValues:{SampleCount:100,Sum:4500.0+i,Minimum:1.2,Maximum:89.5}}:{})}))};
      const c=[]; for(let i=0;i<80*${DATA_SCALAR};++i) c[i]=req; return c;
    })()`,
  },
  {
    name: "list<struct> non-ASCII keys",
    gen: `(() => { const c=[]; for(let i=0;i<600*${DATA_SCALAR};++i) c[i]={"メトリック名":"PAGES_VISITED","ディメンション":[{"名前":"UNIQUE_PAGES","値":"URLS"}],"単位":"None","数値":1.0,"名前空間":"SITE/TRAFFIC"}; return c; })()`,
  },
];

/**
 * @param {"cbor-encode"|"cbor-decode"|"json-encode"|"json-decode"} phase
 * @param {"current"|"baseline"} impl
 */
function runPhase(testIdx, phase, impl) {
  const t = testDefs[testIdx];
  const isCbor = phase.startsWith("cbor");
  const isEncode = phase.endsWith("encode");
  const cwd = impl === "baseline" ? baselineDir : coreDir;

  const script = `
const { fromBase64, toBase64 } = ${base64Requires[impl]};
const { cbor } = ${cborRequires[impl]};
cbor.resizeEncodingBuffer(10_000_000);

const SCALE = ${SCALE};
const name = ${JSON.stringify(t.name)};
const data = ${t.gen};

const cborSerialized = cbor.serialize(data);
const jsonSerialized = name === "byte[]" ? JSON.stringify(toBase64(data)) : JSON.stringify(data);
const bytes = cborSerialized.byteLength;
const jsonBytes = Buffer.from(jsonSerialized).byteLength;

// Warm up
for (let i = 0; i < 50; i++) {
  ${isCbor && isEncode ? "cbor.serialize(data);" : ""}
  ${isCbor && !isEncode ? "cbor.deserialize(cborSerialized);" : ""}
  ${!isCbor && isEncode ? 'if (name === "byte[]") JSON.stringify(toBase64(data)); else JSON.stringify(data);' : ""}
  ${!isCbor && !isEncode ? 'if (name === "byte[]") fromBase64(JSON.parse(jsonSerialized)); else JSON.parse(jsonSerialized);' : ""}
}

const a = performance.now();
for (let i = 0; i < SCALE; i++) {
  ${isCbor && isEncode ? "cbor.serialize(data);" : ""}
  ${isCbor && !isEncode ? "cbor.deserialize(cborSerialized);" : ""}
  ${!isCbor && isEncode ? 'if (name === "byte[]") JSON.stringify(toBase64(data)); else JSON.stringify(data);' : ""}
  ${!isCbor && !isEncode ? 'if (name === "byte[]") fromBase64(JSON.parse(jsonSerialized)); else JSON.parse(jsonSerialized);' : ""}
}
const ms = performance.now() - a;
console.log(JSON.stringify({ ms, bytes, jsonBytes }));
`;
  const wp = workerPaths[impl];
  writeFileSync(wp, script);
  const result = execFileSync("node", [wp], { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
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

function buildTestCaseTable(results) {
  const headers = ["Test Case", "Data Size", "Repetitions", "CBOR Cumulative", "JSON Cumulative", "CBOR/JSON Size"];
  const rows = results.map((r) => [
    "`" + r.name + "`",
    r.bytes < 1e6 ? (r.bytes / 1e3).toFixed(0) + " kb" : (r.bytes / 1e6).toFixed(1) + " mb",
    String(SCALE),
    ((r.bytes * SCALE) / 1e6).toFixed(0) + " mb",
    ((r.jsonBytes * SCALE) / 1e6).toFixed(0) + " mb",
    (r.bytes / r.jsonBytes).toFixed(2),
  ]);
  return mdTable(headers, rows);
}

function buildBenchmarkTable(label, results) {
  const perfHeaders = ["Test Case", "CBOR ser", "CBOR de", "CBOR ser ms", "CBOR de ms", "JSON ser ms", "JSON de ms"];
  const perfRows = results.map((r) => [
    "`" + r.name + "`",
    r.cborEncFmt,
    r.cborDecFmt,
    r.cborEncMs.toFixed(0) + " ms",
    r.cborDecMs.toFixed(0) + " ms",
    r.jsonEncMs.toFixed(0) + " ms",
    r.jsonDecMs.toFixed(0) + " ms",
  ]);

  const ratioHeaders = ["Test Case", "CBOR ser ratio", "CBOR de ratio"];
  const ratioRows = results.map((r) => [
    "`" + r.name + "`",
    (r.cborEncMs / r.jsonEncMs).toFixed(2),
    (r.cborDecMs / r.jsonDecMs).toFixed(2),
  ]);

  return (
    `### ${label}\n\n` +
    mdTable(perfHeaders, perfRows) +
    `\n\nCBOR timing ratio (lower is better):\n\n` +
    mdTable(ratioHeaders, ratioRows)
  );
}

// Run JSON once as control
process.stdout.write("JSON control");
const jsonResults = [];
for (let idx = 0; idx < testDefs.length; ++idx) {
  process.stdout.write(".");
  jsonResults.push({
    enc: runPhase(idx, "json-encode", "current"),
    dec: runPhase(idx, "json-decode", "current"),
  });
}

// Run cbor baseline
process.stdout.write("\nBaseline");
const baselineResults = [];
for (let idx = 0; idx < testDefs.length; ++idx) {
  process.stdout.write(".");
  baselineResults.push({
    enc: runPhase(idx, "cbor-encode", "baseline"),
    dec: runPhase(idx, "cbor-decode", "baseline"),
  });
}

// Run cbor current
process.stdout.write("\nCurrent");
const currentResults = [];
for (let idx = 0; idx < testDefs.length; ++idx) {
  process.stdout.write(".");
  currentResults.push({
    enc: runPhase(idx, "cbor-encode", "current"),
    dec: runPhase(idx, "cbor-decode", "current"),
  });
}

function formatResults(cborData, jsonData) {
  return testDefs.map((t, idx) => {
    const bytes = cborData[idx].enc.bytes;
    const jsonBytes = cborData[idx].enc.jsonBytes;
    const megabytes = (bytes * SCALE) / 1e6;
    const fmt = (ms) => ((megabytes / ms) * 1000).toFixed(0) + "mb/s";
    return {
      name: t.name,
      bytes,
      jsonBytes,
      cborEncMs: cborData[idx].enc.ms,
      cborDecMs: cborData[idx].dec.ms,
      jsonEncMs: jsonData[idx].enc.ms,
      jsonDecMs: jsonData[idx].dec.ms,
      cborEncFmt: fmt(cborData[idx].enc.ms),
      cborDecFmt: fmt(cborData[idx].dec.ms),
      jsonEncFmt: fmt(jsonData[idx].enc.ms),
      jsonDecFmt: fmt(jsonData[idx].dec.ms),
    };
  });
}

const baseFormatted = formatResults(baselineResults, jsonResults);
const currentFormatted = formatResults(currentResults, jsonResults);

console.log("\n## Test Cases\n");
console.log(buildTestCaseTable(currentFormatted));
console.log("\n## Benchmark Results\n");
console.log(buildBenchmarkTable("Baseline: @smithy/core (npm)", baseFormatted));
console.log("");
console.log(buildBenchmarkTable("Current: dist-cjs", currentFormatted));

try {
  unlinkSync(workerPaths.current);
} catch {}
try {
  unlinkSync(workerPaths.baseline);
} catch {}
