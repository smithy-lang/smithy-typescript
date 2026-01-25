// smithy-typescript generated code
import { expect, test as it } from "vitest";

import { GetNumbersCommand } from "../../src/commands/GetNumbersCommand";
import { XYZServiceClient } from "../../src/XYZServiceClient";
import type { HttpHandlerOptions, HeaderBag, Endpoint } from "@smithy/types";
import { type HttpHandler, HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { Readable } from "node:stream";

/**
 * Throws an expected exception that contains the serialized request.
 */
class EXPECTED_REQUEST_SERIALIZATION_ERROR extends Error {
  constructor(readonly request: HttpRequest) {
    super();
  }
}

/**
 * Throws an EXPECTED_REQUEST_SERIALIZATION_ERROR error before sending a
 * request. The thrown exception contains the serialized request.
 */
class RequestSerializationTestHandler implements HttpHandler {
  handle(request: HttpRequest, options?: HttpHandlerOptions): Promise<{ response: HttpResponse }> {
    return Promise.reject(new EXPECTED_REQUEST_SERIALIZATION_ERROR(request));
  }
  updateHttpClientConfig(key: never, value: never): void {}
  httpHandlerConfigs() {
    return {};
  }
}

/**
 * Returns a resolved Promise of the specified response contents.
 */
class ResponseDeserializationTestHandler implements HttpHandler {
  isSuccess: boolean;
  code: number;
  headers: HeaderBag;
  body: string | Uint8Array;
  isBase64Body: boolean;

  constructor(isSuccess: boolean, code: number, headers?: HeaderBag, body?: string) {
    this.isSuccess = isSuccess;
    this.code = code;
    if (headers === undefined) {
      this.headers = {};
    } else {
      this.headers = headers;
    }
    if (body === undefined) {
      body = "";
    }
    this.body = body;
    this.isBase64Body = String(body).length > 0 && Buffer.from(String(body), "base64").toString("base64") === body;
  }

  handle(request: HttpRequest, options?: HttpHandlerOptions): Promise<{ response: HttpResponse }> {
    return Promise.resolve({
      response: new HttpResponse({
        statusCode: this.code,
        headers: this.headers,
        body: this.isBase64Body ? toBytes(this.body as string) : Readable.from([this.body]),
      }),
    });
  }

  updateHttpClientConfig(key: never, value: never): void {}

  httpHandlerConfigs() {
    return {};
  }
}

interface comparableParts {
  [key: string]: string;
}

/**
 * Generates a standard map of un-equal values given input parts.
 */
const compareParts = (expectedParts: comparableParts, generatedParts: comparableParts) => {
  const unequalParts: any = {};
  Object.keys(expectedParts).forEach((key) => {
    if (generatedParts[key] === undefined) {
      unequalParts[key] = { exp: expectedParts[key], gen: undefined };
    } else if (!equivalentContents(expectedParts[key], generatedParts[key])) {
      unequalParts[key] = { exp: expectedParts[key], gen: generatedParts[key] };
    }
  });

  Object.keys(generatedParts).forEach((key) => {
    if (expectedParts[key] === undefined) {
      unequalParts[key] = { exp: undefined, gen: generatedParts[key] };
    }
  });

  if (Object.keys(unequalParts).length !== 0) {
    return unequalParts;
  }
  return undefined;
};

/**
 * Compares all types for equivalent contents, doing nested
 * equality checks based on non-`$metadata`
 * properties that have defined values.
 */
const equivalentContents = (expected: any, generated: any): boolean => {
  if (typeof (global as any).expect === "function") {
    expect(normalizeByteArrayType(generated)).toEqual(normalizeByteArrayType(expected));
    return true;
  }

  let localExpected = expected;

  // Short circuit on equality.
  if (localExpected == generated) {
    return true;
  }

  if (typeof expected !== "object") {
    return expected === generated;
  }

  // If a test fails with an issue in the below 6 lines, it's likely
  // due to an issue in the nestedness or existence of the property
  // being compared.
  delete localExpected["$metadata"];
  delete generated["$metadata"];
  Object.keys(localExpected).forEach((key) => localExpected[key] === undefined && delete localExpected[key]);
  Object.keys(generated).forEach((key) => generated[key] === undefined && delete generated[key]);

  const expectedProperties = Object.getOwnPropertyNames(localExpected);
  const generatedProperties = Object.getOwnPropertyNames(generated);

  // Short circuit on different property counts.
  if (expectedProperties.length != generatedProperties.length) {
    return false;
  }

  // Compare properties directly.
  for (var index = 0; index < expectedProperties.length; index++) {
    const propertyName = expectedProperties[index];
    if (!equivalentContents(localExpected[propertyName], generated[propertyName])) {
      return false;
    }
  }

  return true;
};

const clientParams = {
  region: "us-west-2",
  credentials: { accessKeyId: "key", secretAccessKey: "secret" },
  apiKey: { apiKey: "apiKey" },
  endpoint: () => {
    const url = new URL("https://localhost/");
    return Promise.resolve({
      hostname: url.hostname,
      protocol: url.protocol,
      path: url.pathname,
    }) as Promise<Endpoint>;
  },
};

/**
 * A wrapper function that shadows `fail` from jest-jasmine2
 * (jasmine2 was replaced with circus in > v27 as the default test runner)
 */
const fail = (error?: any): never => {
  throw new Error(error);
};

/**
 * Hexadecimal to byteArray.
 */
const toBytes = (hex: string) => {
  return Buffer.from(hex, "base64");
};

function normalizeByteArrayType(data: any) {
  // normalize float32 errors
  if (typeof data === "number") {
    const u = new Uint8Array(4);
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    dv.setFloat32(0, data);
    return dv.getFloat32(0);
  }
  if (!data || typeof data !== "object") {
    return data;
  }
  if (data instanceof Uint8Array) {
    return Uint8Array.from(data);
  }
  if (data instanceof String || data instanceof Boolean || data instanceof Number) {
    return data.valueOf();
  }
  const output = {} as any;
  for (const key of Object.getOwnPropertyNames(data)) {
    output[key] = normalizeByteArrayType(data[key]);
  }
  return output;
}

const WARMUP_ITERATIONS = 10_000;
const BENCHMARK_ITERATIONS = 10_000;
const BENCHMARK_TIMEOUT = 60_000;

it("GetNumbersRequestExample:SerdeBenchmark:Request", async () => {
  const client = new XYZServiceClient({
    ...clientParams,
    requestHandler: new RequestSerializationTestHandler(),
  });

  const command = new GetNumbersCommand(
    {
    } as any,
  );
  const timings = [] as number[];
  const testStart = performance.now();
  const numeric = (a: number, b: number) => a - b;
  let i = 0;

  while (++i) {
    const preSerialize = performance.now();
    try {
      await client.send(command);
      fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
      return;
    } catch (err) {
      if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
        fail(err);
        return;
      }
      const r = err.request;
    };
    const postSerialize = performance.now();
    if (i >= WARMUP_ITERATIONS) {
      // allow warmup
      timings.push(postSerialize * 1_000_000 - preSerialize  * 1_000_000);
    }

    if (timings.length >= BENCHMARK_ITERATIONS) {
      timings.length = BENCHMARK_ITERATIONS;
      break;
    } else if (testStart + 30_000 < preSerialize) {
      break;
    }
  }

  timings.sort(numeric);

  const n = timings.length;
  const p50 = timings[(n - 1) * 0.50 | 0] | 0;
  const p90 = timings[(n - 1) * 0.90 | 0] | 0;
  const p95 = timings[(n - 1) * 0.95 | 0] | 0;
  const p99 = timings[(n - 1) * 0.99 | 0] | 0;
  const mean = timings.reduce((a, b) => a + b, 0) / timings.length | 0;
  const stdDev = Math.sqrt(timings.reduce((a, b) => a + (b - mean) ** 2, 0) / timings.length) | 0;

  console.info("GetNumbersRequestExample:SerdeBenchmark:Request");
  const fmt = (n: number) => String(n.toLocaleString()).padStart(10, ' ');
  console.table({
    n: fmt(n),
    p50: fmt(p50),
    p90: fmt(p90),
    p95: fmt(p95),
    p99: fmt(p99),
    mean: fmt(mean),
    stdDev: fmt(stdDev),
  });

  const decile = p95 / 10;
  let d = 1;
  const centIndex = (n / 100) | 0;
  let line = "";

  console.info("=".repeat(31), "Distribution Viz", "=".repeat(31));
  for (let i = 0; i < n; i += centIndex) {
    const t = timings[i];
    if (t < decile * d) {
      line += ".";
    } else {
      line += ` <= ${(decile * d) | 0}`;
      console.info(line);
      d += 1;
      line = ".";
    }
  }
  console.info(line + ` > ${(decile * (d - 1)) | 0}`);
  console.info("=".repeat(80));

}, BENCHMARK_TIMEOUT);

it("GetNumbersResponseExample:SerdeBenchmark:Response", async () => {
  const client = new XYZServiceClient({
    ...clientParams,
    requestHandler: new ResponseDeserializationTestHandler(
      true,
      200,
      {
        "smithy-protocol": "rpc-v2-cbor",
      }
    ),
  });

  const params: any = {};
  const command = new GetNumbersCommand(params);

  const timings = [] as number[];
  const numeric = (a: number, b: number) => a - b;
  let i = 0;

  client.middlewareStack.addRelativeTo(
      (next: any) => async (args: any) => {
        const preDeserialize = performance.now();
        const r = await next(args);
        const postDeserialize = performance.now();
        if (i >= WARMUP_ITERATIONS) {
          timings.push(postDeserialize * 1_000_000 - preDeserialize * 1_000_000);
        }
        return r;
      },
      {
        name: "deserializerBenchmarkMiddleware",
        toMiddleware: "deserializerMiddleware",
        relation: "before",
        override: true,
      }
  );

  const benchmarkStart = performance.now();

  while (++i) {
    let r: any;
    try {
      r = await client.send(command);
    } catch (err) {
      fail("Expected a valid response to be returned, got " + err);
      return;
    }
    if (i >= WARMUP_ITERATIONS + BENCHMARK_ITERATIONS) {
      break;
    } else if (benchmarkStart + 30_000 < performance.now()) {
      break;
    }
  }

  timings.sort(numeric);
  timings.length = Math.min(timings.length, BENCHMARK_ITERATIONS);

  const n = timings.length;
  const p50 = timings[(n - 1) * 0.50 | 0] | 0;
  const p90 = timings[(n - 1) * 0.90 | 0] | 0;
  const p95 = timings[(n - 1) * 0.95 | 0] | 0;
  const p99 = timings[(n - 1) * 0.99 | 0] | 0;
  const mean = timings.reduce((a, b) => a + b, 0) / timings.length | 0;
  const stdDev = Math.sqrt(timings.reduce((a, b) => a + (b - mean) ** 2, 0) / timings.length) | 0;

  console.info("GetNumbersResponseExample:SerdeBenchmark:Response");
  const fmt = (n: number) => String(n.toLocaleString()).padStart(10, ' ');
  console.table({
    n: fmt(n),
    p50: fmt(p50),
    p90: fmt(p90),
    p95: fmt(p95),
    p99: fmt(p99),
    mean: fmt(mean),
    stdDev: fmt(stdDev),
  });

  const decile = p95 / 10;
  let d = 1;
  const centIndex = (n / 100) | 0;
  let line = "";

  console.info("=".repeat(31), "Distribution Viz", "=".repeat(31));
  for (let i = 0; i < n; i += centIndex) {
    const t = timings[i];
    if (t < decile * d) {
      line += ".";
    } else {
      line += ` <= ${(decile * d) | 0}`;
      console.info(line);
      d += 1;
      line = ".";
    }
  }
  console.info(line + ` > ${(decile * (d - 1)) | 0}`);
  console.info("=".repeat(80));

}, BENCHMARK_TIMEOUT);
