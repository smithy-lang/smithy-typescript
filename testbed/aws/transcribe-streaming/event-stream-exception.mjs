/**
 * E2E proof for event-stream modeled exception handling (issue #2169).
 *
 * See: https://github.com/smithy-lang/smithy-typescript/issues/2169
 */

import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  BadRequestException,
} from "@aws-sdk/client-transcribe-streaming";
import { TranscribeStreamingServiceException } from "@aws-sdk/client-transcribe-streaming";

const REGION = "us-east-1";

const client = new TranscribeStreamingClient({ region: REGION });

/**
 * Creates an async iterable that first yields valid PCM silence (to get
 * normal events flowing), then after a delay yields a large garbage chunk
 * declared as part of the same stream. The initial valid audio ensures the
 * service sends at least one TranscriptEvent before encountering the bad data.
 */
function createInvalidAudioStream() {
  return {
    async *[Symbol.asyncIterator]() {
      // Send valid PCM silence (16-bit LE, 16kHz) for ~1 second
      // 16000 samples/sec * 2 bytes/sample = 32000 bytes/sec
      const silence = new Uint8Array(32000); // 1 second of silence
      yield { AudioEvent: { AudioChunk: silence } };

      await new Promise((r) => setTimeout(r, 1000));

      // Now send a massive garbage chunk to trigger "stream is too big"
      yield { AudioEvent: { AudioChunk: crypto.getRandomValues(new Uint8Array(128 * 1024)) } };
    },
  };
}

// ─── Test ────────────────────────────────────────────────────────────────────

async function testEventStreamModeledException() {
  console.log("  Sending invalid audio to Transcribe Streaming...");
  console.log("  (expecting a BadRequestException as an event-stream exception frame)\n");

  let httpThrown;
  let thrown;
  let response;

  try {
    response = await client.send(
      new StartStreamTranscriptionCommand({
        LanguageCode: "en-US",
        MediaEncoding: "pcm",
        MediaSampleRateHertz: 16000,
        AudioStream: createInvalidAudioStream(),
      })
    );
  } catch (e) {
    httpThrown = e;
  }

  if (httpThrown) {
    console.log("Service threw on the HTTP transaction, unable to test response event stream.");
    process.exit(1);
  }

  try {
    // Iterate the response event stream — the exception should arrive here
    for await (const event of response?.TranscriptResultStream ?? []) {
      console.log("  Received event:", JSON.stringify(event).slice(0, 200));
    }

    // If we complete without error, the test setup didn't trigger the exception
    console.log("\n  ⚠️  No exception was thrown — service accepted the audio.");
    console.log("  This test requires the service to reject the audio stream.");
    process.exit(2);
  } catch (asyncIterableThrown) {
    thrown = asyncIterableThrown;
  }

  console.log("  Exception caught. Inspecting...\n");
  console.log("  thrown value:", thrown);
  console.log("  typeof:", typeof thrown);
  console.log("  constructor.name:", thrown?.constructor?.name ?? "(none)");
  console.log("");

  // ─── Assertions ──────────────────────────────────────────────────────────

  console.log({
    asyncIterableThrown: [thrown?.constructor?.name, thrown?.message],
    httpThrown: httpThrown ? [httpThrown?.constructor?.name, httpThrown?.message] : undefined,
  });

  console.log("actuals", {
    thrown,
    httpThrown,
  });

  return thrown instanceof TranscribeStreamingServiceException;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(70));
console.log("E2E: Event-stream modeled exception instanceof check (issue #2169)");
console.log("=".repeat(70));
console.log(`  Region: ${REGION}`);
console.log(`  Service: Amazon Transcribe Streaming`);
console.log(`  Operation: StartStreamTranscription\n`);

let passed = false;
try {
  passed = await testEventStreamModeledException();
} catch (err) {
  console.error(`\n  ❌ Unexpected failure: ${err.message ?? err}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
} finally {
  client.destroy();
}

console.log("\n" + "=".repeat(70));
if (passed) {
  console.log("✅ E2E test PASSED");
} else {
  console.log("❌ E2E test FAILED");
  process.exit(1);
}
