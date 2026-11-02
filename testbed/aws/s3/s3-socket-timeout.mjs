/**
 * Manual check, not run in CI: S3 GetObject whose response body is never read.
 *
 * For 5 KiB and 500 KiB objects, sends GetObject without reading the body and records when the
 * socket closes, whether the client socket timeout or S3 closed it, and whether the body can
 * still be read afterwards. A 5 KiB body arrives completely before anything closes, so it must
 * stay readable. A 500 KiB body stalls under backpressure, so a configured socketTimeout must
 * fail it with a TimeoutError, unless S3 drops the connection first.
 *
 * Needs credentials for a test account, e.g. AWS_PROFILE=<profile> make socket-timeout. Set
 * SMITHY_E2E_S3_BUCKET to use a bucket other than smithy-ts-e2e-us-west-2.
 */

import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "node:crypto";

const REGION = "us-west-2";
const BUCKET = process.env.SMITHY_E2E_S3_BUCKET ?? `smithy-ts-e2e-${REGION}`;
const PREFIX = `smithy-e2e-socket-timeout/${Date.now()}-${crypto.randomUUID()}`;
const SIZES = [5 * 1024, 500 * 1024];
const CONFIGS = [
  { label: "no socketTimeout", requestHandler: undefined, capMs: 40_000 },
  { label: "socketTimeout 3000", requestHandler: { socketTimeout: 3000 }, timeoutMs: 3000, capMs: 20_000 },
  { label: "socketTimeout 10000", requestHandler: { socketTimeout: 10_000 }, timeoutMs: 10_000, capMs: 30_000 },
];

const client = new S3Client({ region: REGION });
const createdKeys = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureBucket() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      console.log(`  Creating bucket s3://${BUCKET}`);
      const params = { Bucket: BUCKET };
      if (REGION !== "us-east-1") {
        params.CreateBucketConfiguration = { LocationConstraint: REGION };
      }
      await client.send(new CreateBucketCommand(params));
    } else {
      throw err;
    }
  }
}

async function setup() {
  await ensureBucket();
  for (const size of SIZES) {
    const Key = `${PREFIX}/${size}`;
    console.log(`  PUT s3://${BUCKET}/${Key} (${size} bytes)`);
    await client.send(new PutObjectCommand({ Bucket: BUCKET, Key, Body: crypto.randomBytes(size) }));
    createdKeys.push(Key);
  }
}

async function teardown() {
  for (const Key of createdKeys) {
    console.log(`  DELETE s3://${BUCKET}/${Key}`);
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }));
  }
}

async function readAll(body) {
  let bytes = 0;
  for await (const chunk of body) {
    bytes += chunk.length;
  }
  return bytes;
}

// ─── Test ────────────────────────────────────────────────────────────────────

/**
 * GetObject, then leave the body unread until the socket closes or capMs passes.
 */
async function unreadGetObject(size, config) {
  // Raw IncomingMessage body: response checksum validation would wrap it and hide the socket.
  const c = new S3Client({
    region: REGION,
    requestHandler: config.requestHandler,
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const start = Date.now();
  const elapsed = () => Date.now() - start;
  try {
    const { Body: body } = await c.send(new GetObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}/${size}` }));
    const result = { size, config: config.label, headersMs: elapsed() };
    const socket = body.socket;

    await new Promise((resolve) => {
      const cap = setTimeout(resolve, config.capMs);
      socket.once("end", () => (result.serverEndMs ??= elapsed()));
      socket.once("timeout", () => (result.socketTimeoutMs ??= elapsed()));
      body.once("error", (e) => (result.bodyError ??= `${e.name}: ${e.message.slice(0, 80)}`));
      socket.once("close", () => {
        result.closeMs = elapsed();
        result.completeAtClose = body.complete;
        clearTimeout(cap);
        resolve();
      });
    });

    if (!result.bodyError) {
      try {
        result.bytesRead = await readAll(body);
      } catch (e) {
        result.bodyError = `${e.name}: ${e.message.slice(0, 80)}`;
      }
    }
    return result;
  } finally {
    c.destroy();
  }
}

/**
 * Failures against what the socket timeout promises. The no-socketTimeout runs only report what
 * S3 does with an idle, unread connection.
 */
function check(r, config) {
  const problems = [];
  if (r.size === SIZES[0] && r.bytesRead !== r.size) {
    problems.push(`complete body not readable: read ${r.bytesRead ?? 0} of ${r.size} bytes (${r.bodyError})`);
  }
  if (r.size === SIZES[1] && config.timeoutMs) {
    if (r.closeMs === undefined) {
      problems.push(`socket still open after ${config.capMs} ms`);
    } else if (r.socketTimeoutMs !== undefined && !r.bodyError?.startsWith("TimeoutError")) {
      problems.push(`socket timeout fired but body error was ${r.bodyError ?? "none"}`);
    }
  }
  return problems;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(60));
console.log("E2E: S3 GetObject with an unread body, local @smithy packages");
console.log("=".repeat(60));
console.log(`  Region: ${REGION}`);
console.log(`  Bucket: ${BUCKET}`);
console.log(`  Prefix: ${PREFIX}\n`);

let failed = false;
try {
  await setup();
  const runs = SIZES.flatMap((size) => CONFIGS.map((config) => ({ size, config })));
  console.log(
    `\n  Running ${runs.length} GetObject calls in parallel (up to ${Math.max(...CONFIGS.map((c) => c.capMs)) / 1000}s)\n`
  );
  const results = await Promise.all(runs.map(({ size, config }) => unreadGetObject(size, config)));

  for (const [i, r] of results.entries()) {
    const problems = check(r, runs[i].config);
    failed ||= problems.length > 0;
    const closedBy =
      r.closeMs === undefined
        ? "still open"
        : r.socketTimeoutMs !== undefined
          ? "client socket timeout"
          : r.serverEndMs !== undefined
            ? "S3"
            : "unknown";
    console.log(`  ${problems.length ? "❌" : "✅"} ${r.size / 1024} KiB, ${r.config}`);
    console.log(
      `      headers ${r.headersMs} ms, socket closed ${r.closeMs === undefined ? "-" : `at ${r.closeMs} ms`} by ${closedBy}` +
        `, complete=${r.completeAtClose ?? "-"}`
    );
    console.log(`      body: ${r.bodyError ?? `read ${r.bytesRead} bytes`}`);
    for (const p of problems) {
      console.log(`      ! ${p}`);
    }
  }
} catch (err) {
  console.error(`\n  ❌ FAILED: ${err.message}`);
  if (err.Code || err.$metadata) {
    console.error("  AWS Error:", JSON.stringify({ Code: err.Code, ...err.$metadata }, null, 2));
  }
  failed = true;
} finally {
  try {
    await teardown();
  } catch (e) {
    console.error(`  ⚠️  Teardown failed: ${e.message}`);
  }
}

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error("❌ E2E test FAILED");
  process.exit(1);
} else {
  console.log("✅ E2E test PASSED");
}
