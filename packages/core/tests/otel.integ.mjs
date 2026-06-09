/**
 * OTel instrumentation compatibility test for smithy core runtime.
 *
 * Tests that @opentelemetry/instrumentation-aws-sdk produces spans when
 * used with smithy-typescript clients. Uses the real OTel SDK with an
 * in-memory exporter.
 *
 * IMPORTANT: Must run with --preserve-symlinks for workspace-linked
 * packages to be intercepted by require-in-the-middle.
 *
 * Run from repo root:
 *   node --preserve-symlinks --preserve-symlinks-main packages/core/tests/otel.integ.mjs
 */

// --- Setup OTel BEFORE any SDK imports ---
import { AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
provider.register();
registerInstrumentations({
  instrumentations: [new AwsInstrumentation()],
});

// --- Dynamic imports so OTel hooks have a chance to intercept ---
const { cbor } = await import("@smithy/core/cbor");
const { HttpResponse } = await import("@smithy/protocol-http");
const { GetNumbersCommand, XYZService } = await import("xyz-schema");

function mockHandler(response) {
  return {
    handle: async () => ({ response }),
    updateHttpClientConfig() {},
    httpHandlerConfigs() { return {}; },
  };
}

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) {
    failed++;
    console.error(`  ✗ ${msg}`);
  } else {
    passed++;
    console.log(`  ✓ ${msg}`);
  }
}

// --- Test 1: span produced on successful send ---
{
  exporter.reset();
  const client = new XYZService({
    endpoint: "https://localhost",
    apiKey: async () => ({ apiKey: "test-key" }),
  });
  client.config.requestHandler = mockHandler(
    new HttpResponse({
      headers: { "smithy-protocol": "rpc-v2-cbor" },
      statusCode: 200,
      body: cbor.serialize({ numbers: [1, 2, 3] }),
    })
  );

  await client.send(new GetNumbersCommand({}));

  const spans = exporter.getFinishedSpans();
  assert(spans.length >= 1, `span produced on success (got ${spans.length})`);

  const awsSpan = spans.find((s) => s.name.includes("GetNumbers"));
  assert(awsSpan !== undefined, "span name contains GetNumbers");
}

// --- Test 2: span has rpc.service and rpc.method attributes ---
{
  exporter.reset();
  const client = new XYZService({
    endpoint: "https://localhost",
    apiKey: async () => ({ apiKey: "test-key" }),
  });
  client.config.requestHandler = mockHandler(
    new HttpResponse({
      headers: { "smithy-protocol": "rpc-v2-cbor" },
      statusCode: 200,
      body: cbor.serialize({ numbers: [42] }),
    })
  );

  await client.send(new GetNumbersCommand({ maxResults: 10 }));

  const spans = exporter.getFinishedSpans();
  const awsSpan = spans.find((s) => s.name.includes("GetNumbers"));
  assert(awsSpan !== undefined, "span found for attribute check");
  if (awsSpan) {
    const attrs = awsSpan.attributes;
    assert(
      attrs["rpc.service"] || attrs["aws.service"],
      `rpc.service or aws.service present (got ${attrs["rpc.service"] ?? attrs["aws.service"]})`
    );
    assert(
      attrs["rpc.method"] || attrs["aws.operation"],
      `rpc.method or aws.operation present (got ${attrs["rpc.method"] ?? attrs["aws.operation"]})`
    );
  }
}

// --- Test 3: error span on failure ---
{
  exporter.reset();
  const client = new XYZService({
    endpoint: "https://localhost",
    apiKey: async () => ({ apiKey: "test-key" }),
  });
  client.config.requestHandler = mockHandler(
    new HttpResponse({
      headers: { "smithy-protocol": "rpc-v2-cbor" },
      statusCode: 400,
      body: cbor.serialize({ __type: "RetryableError", message: "something went wrong" }),
    })
  );

  try {
    await client.send(new GetNumbersCommand({}));
  } catch {
    // expected
  }

  const spans = exporter.getFinishedSpans();
  const awsSpan = spans.find((s) => s.name.includes("GetNumbers"));
  assert(awsSpan !== undefined, "error span found");
  if (awsSpan) {
    assert(awsSpan.status.code === 2, `span status is ERROR (got ${awsSpan.status.code})`);
  }
}

await provider.shutdown();

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
