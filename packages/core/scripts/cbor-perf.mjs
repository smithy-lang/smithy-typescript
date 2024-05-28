import { fromBase64, toBase64 } from "@smithy/util-base64";

import * as SmithyCbor from "../dist-cjs/submodules/cbor/index.js";

/**
 * Control the test data size with this scalar.
 */
const DATA_SCALAR = 5;

const tests = [
  {
    name: "string",
    data: (() => {
      const buffer = [];
      for (let i = 0; i < 3400 * DATA_SCALAR; ++i) {
        buffer[i] = Math.random() + "";
      }
      return buffer.join("代码");
    })(),
    run: true,
  },
  {
    name: "list<char>",
    data: (() => {
      const list = [];
      for (let i = 0; i < 9000 * DATA_SCALAR; ++i) {
        list[i] = "abcdefghijklmnopqrstuvwxyz"[(Math.random() * 26) | 0];
      }
      return list;
    })(),
    run: false,
  },
  {
    name: "list<string(0,180)>",
    data: (() => {
      const list = [];
      for (let i = 0; i < 900 * DATA_SCALAR; ++i) {
        list[i] = "string".repeat((Math.random() * 35) | 0);
      }
      return list;
    })(),
    run: true,
  },
  {
    name: "list<float(0,1)>",
    data: (() => {
      const list = [];
      for (let i = 0; i < 6000 * DATA_SCALAR; ++i) {
        list[i] = Math.random() * 2 - 1;
      }
      return list;
    })(),
    run: false,
  },
  {
    name: "list<float>",
    data: (() => {
      const list = [];
      for (let i = 0; i < 6000 * DATA_SCALAR; ++i) {
        list[i] = Math.random() * 3.4e38;
      }
      return list;
    })(),
    run: true,
  },
  {
    name: "list<double>",
    data: (() => {
      const list = [];
      for (let i = 0; i < 6000 * DATA_SCALAR; ++i) {
        list[i] = Math.random() * Number.MAX_VALUE;
      }
      return list;
    })(),
    run: true,
  },
  {
    name: "byte[]",
    data: (() => {
      const list = new Uint8Array(100000 * DATA_SCALAR);
      for (let i = 0; i < list.length; ++i) {
        list[i] = ((Math.random() * 20000) | 0) % 255;
      }
      return list;
    })(),
    run: true,
  },
  {
    name: "list<int>",
    data: (() => {
      const list = [];
      for (let i = 0; i < 17000 * DATA_SCALAR; ++i) {
        list[i] = ((Math.random() * 20000) | 0) - 10000;
      }
      return list;
    })(),
    run: true,
  },
  {
    name: "list<long int>",
    data: (() => {
      const list = [];
      for (let i = 0; i < 10000 * DATA_SCALAR; ++i) {
        list[i] = Math.floor(Math.random() * 0x7fffffff * 2 - 0x7fffffff);
      }
      return list;
    })(),
    run: true,
  },
  {
    name: "list<long long int>",
    data: (() => {
      const list = [];
      for (let i = 0; i < 10000 * DATA_SCALAR; ++i) {
        list[i] = Math.floor(-18446744073709551615 + ((Math.random() * 2 * 18446744073709551615) | 0));
      }
      return list;
    })(),
    run: true,
  },
  {
    name: "map<int, char>",
    data: (() => {
      const map = {};
      for (let i = 0; i < 2000 * DATA_SCALAR; ++i) {
        map[i] = "abcdefg"[(Math.random() * 5.999) | 0];
      }
      return map;
    })(),
    run: false,
  },
  {
    name: "map<string(0,30), string(0,450)>",
    data: (() => {
      const map = {};
      for (let i = 0; i < 324 * DATA_SCALAR; ++i) {
        map["key".repeat((Math.random() * 10) | 0) + i] = "key".repeat((Math.random() * 155) | 0) + i + Math.random();
      }
      return map;
    })(),
    run: true,
  },
  {
    name: "map<string(0,30), long int>",
    data: (() => {
      const map = {};
      for (let i = 0; i < 324 * DATA_SCALAR; ++i) {
        map["key".repeat((Math.random() * 10) | 0) + i] = Math.floor(Math.random() * 0x7fffffff * 2 - 0x7fffffff);
      }
      return map;
    })(),
    run: true,
  },
  {
    name: "list<struct> PutMetricData-like",
    data: (() => {
      const collection = [];
      for (let i = 0; i < 600 * DATA_SCALAR; ++i) {
        collection[i] = {
          MetricData: [
            {
              MetricName: "PAGES_VISITED",
              Dimensions: [
                {
                  Name: "UNIQUE_PAGES",
                  Value: "URLS",
                },
              ],
              Unit: "None",
              Value: 1.0,
            },
          ],
          Namespace: "SITE/TRAFFIC",
        };
      }
      return collection;
    })(),
    run: true,
  },
];

const { cbor } = SmithyCbor;
cbor.resizeEncodingBuffer(10_000_000);

const SCALE = (3 * 100) / DATA_SCALAR;
class Row {
  constructor(data) {
    Object.assign(this, data);
  }
}
const rows = {};

for (const { name, data, run, nonScaling } of tests) {
  if (!run) {
    continue;
  }
  const scale = nonScaling ? 1 : SCALE;

  const A = performance.now();
  let cborSerialized;
  {
    for (let i = 0; i < scale; ++i) {
      cborSerialized = cbor.serialize(data);
    }
  }
  const B = performance.now();
  let cborDeserialized;
  {
    for (let i = 0; i < scale; ++i) {
      cborDeserialized = cbor.deserialize(cborSerialized);
    }
  }
  const C = performance.now();
  const D = performance.now();
  const E = performance.now();
  const F = performance.now();
  const G = performance.now();

  let jsonSerialized;
  {
    for (let i = 0; i < scale; ++i) {
      if (name === "byte[]") {
        jsonSerialized = JSON.stringify(toBase64(data));
      } else {
        jsonSerialized = JSON.stringify(data);
      }
    }
  }
  const H = performance.now();
  let jsonDeserialized;
  {
    for (let i = 0; i < scale; ++i) {
      if (name === "byte[]") {
        jsonDeserialized = fromBase64(JSON.parse(jsonSerialized));
      } else {
        jsonDeserialized = JSON.parse(jsonSerialized);
      }
    }
  }
  const I = performance.now();
  const bytes = cborSerialized.byteLength;
  const megabytes = (cborSerialized.byteLength * scale) / 1_000_000;
  const num_fmt = (ms) => ((megabytes / ms) * 1000).toFixed(0) + "mb/s";
  const jsonBytes = Buffer.from(jsonSerialized).byteLength;
  process.stdout.write(".");

  rows[name] = new Row({
    workload: `${(bytes < 1e6 ? bytes / 1e3 : bytes / 1e6).toFixed(0)}${bytes < 1e6 ? "kb" : "mb"} x ${scale}`,
    cbor: ((bytes * scale) / 1e6).toFixed(0) + "mb",
    json: ((jsonBytes * scale) / 1e6).toFixed(0) + "mb",
    cbor_serde: [B - A, C - B].map(num_fmt).join(", "),
    json_serde: [H - G, I - H].map(num_fmt).join(", "),
    "cbor relative performance": [
      (((H - G) / (B - A)) * 100).toFixed(0) + "% ->",
      "<- " + (((I - H) / (C - B)) * 100).toFixed(0) + "%",
      ((bytes / jsonBytes) * 100).toFixed(0) + "% payload",
    ].join(", "),
  });
}

console.log("");
console.table(rows);
