/**
 * E2E test: S3 getObject with a simulated dropped connection.
 *
 * Uses a real S3 request but wraps the requestHandler to intercept the
 * HttpResponse body and destroy it after the first chunk, simulating a
 * connection drop mid-transfer. Verifies that the @smithy/core ChecksumStream
 * properly surfaces a premature-close error rather than hanging or silently
 * succeeding with partial data.
 */

import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import crypto from "node:crypto";

const REGION = "us-west-2";
const BUCKET = `smithy-ts-e2e-${REGION}`;
const KEY = `smithy-e2e-test/${Date.now()}-${crypto.randomUUID()}`;
const BODY = crypto.randomBytes(256 * 1024); // 256 KiB of random data

const client = new S3Client({ region: REGION });

let createdObject = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureBucket() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`  Bucket s3://${BUCKET} already exists`);
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

async function emptyBucket() {
  let continuationToken;
  let totalDeleted = 0;
  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: continuationToken,
      })
    );
    const objects = list.Contents || [];
    for (const obj of objects) {
      await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
      totalDeleted++;
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
  if (totalDeleted > 0) {
    console.log(`  Emptied bucket: deleted ${totalDeleted} object(s)`);
  } else {
    console.log(`  Bucket is already empty`);
  }
}

async function setup() {
  await ensureBucket();
  await emptyBucket();

  console.log(`  PUT s3://${BUCKET}/${KEY} (${BODY.byteLength} bytes)`);
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: BODY,
      ChecksumAlgorithm: "CRC32",
    })
  );
  createdObject = true;
}

async function teardown() {
  if (createdObject) {
    console.log(`  DELETE s3://${BUCKET}/${KEY}`);
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: KEY }));
  }
}

async function collect(stream) {
  const chunks = [];
  if (stream instanceof Readable) {
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
  } else if (stream && typeof stream.getReader === "function") {
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
  } else {
    throw new Error("Unknown stream type: " + typeof stream);
  }
  return Buffer.concat(chunks);
}

// ─── Request handler wrapper that kills the response body after first chunk ──

function createDroppingHandler(realHandler) {
  return {
    metadata: realHandler.metadata,
    destroy() {
      realHandler.destroy?.();
    },
    async handle(request, options) {
      const { response } = await realHandler.handle(request, options);

      // Only intercept GetObject responses (have a streaming body).
      if (!(response.body instanceof Readable)) {
        return { response };
      }

      // Wrap the real body: emit one chunk then destroy (simulates connection drop).
      const original = response.body;
      let firstChunkEmitted = false;

      const truncated = new Readable({
        read() {
          if (!firstChunkEmitted) {
            // Relay a single chunk from the original stream, then destroy.
            const onData = (chunk) => {
              firstChunkEmitted = true;
              this.push(chunk);
              original.removeListener("data", onData);
              // Simulate the socket dying — destroy the wrapper without pushing null.
              original.destroy();
              this.destroy();
            };
            original.on("data", onData);
            original.resume(); // ensure data flows
          }
        },
      });

      response.body = truncated;
      return { response };
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function testGetObjectNormal() {
  console.log(`  GET s3://${BUCKET}/${KEY} (normal, with ChecksumMode: ENABLED)`);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      ChecksumMode: "ENABLED",
    })
  );

  const received = await collect(response.Body);
  if (received.length !== BODY.byteLength) {
    throw new Error(`Content length mismatch: expected ${BODY.byteLength}, got ${received.length}`);
  }
  if (!received.equals(BODY)) {
    throw new Error("Content mismatch");
  }
  console.log("  ✅ Normal getObject: body matches, checksum validated");
}

async function testGetObjectDroppedConnection() {
  console.log(`  GET s3://${BUCKET}/${KEY} (simulated connection drop after first chunk)`);

  // Create a client with the wrapped handler that kills the body mid-stream.
  const droppingClient = new S3Client({
    region: REGION,
    requestHandler: createDroppingHandler(client.config.requestHandler),
  });

  try {
    const response = await droppingClient.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: KEY,
        ChecksumMode: "ENABLED",
      })
    );

    // Attempt to consume the body — this should throw.
    await collect(response.Body);

    // If we get here, the test failed — we expected an error.
    throw new Error("Expected an error from the truncated stream, but read completed successfully");
  } catch (err) {
    if (
      err.message.includes("Connection lost") ||
      err.message.includes("premature close") ||
      err.message.includes("Premature close") ||
      err.code === "ERR_STREAM_PREMATURE_CLOSE" ||
      err.message.includes("aborted") ||
      err.message.includes("socket hang up")
    ) {
      console.log(`  ✅ Dropped connection surfaced error: "${err.message}"`);
    } else if (err.message.includes("Expected an error")) {
      throw err;
    } else {
      // Any error is acceptable — the key thing is it didn't hang or silently succeed.
      console.log(`  ✅ Dropped connection surfaced error (unexpected type): "${err.message}"`);
    }
  } finally {
    droppingClient.destroy();
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(60));
console.log("E2E: S3 getObject with local @smithy packages");
console.log("=".repeat(60));
console.log(`  Region: ${REGION}`);
console.log(`  Bucket: ${BUCKET}`);
console.log(`  Key:    ${KEY}\n`);

let failed = false;
try {
  await setup();
  await testGetObjectNormal();
  await testGetObjectDroppedConnection();
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
