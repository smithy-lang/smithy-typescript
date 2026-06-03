import { once } from "node:events";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { createServer } from "node:http";
import { HttpRequest } from "@smithy/core/protocols";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent } from "undici";
import { afterAll, beforeAll, bench, describe } from "vitest";

import { UndiciHttpHandler } from "./undici-http-handler";

// ---------------------------------------------------------------------------
// 1. Spin up a local HTTP server
// ---------------------------------------------------------------------------

const RESPONSE_BODY = JSON.stringify({ ok: true, ts: Date.now() });

const server = createServer((_req, res) => {
  res.writeHead(200, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(RESPONSE_BODY),
  });
  res.end(RESPONSE_BODY);
});

// ---------------------------------------------------------------------------
// 2. Helper to build a Smithy HttpRequest targeting the local server
// ---------------------------------------------------------------------------

let port: number;

function makeRequest(overrides = {}) {
  return Object.assign(
    new HttpRequest({
      protocol: "http:",
      hostname: "127.0.0.1",
      port,
      method: "GET",
      path: "/",
      headers: {},
    }),
    overrides
  );
}

// Drain the response body so the connection can be reused.
async function drain(response: { body?: AsyncIterable<unknown> }) {
  if (response.body) {
    for await (const _ of response.body) {
      // discard
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Create handler instances
// ---------------------------------------------------------------------------

const nodeHandler = new NodeHttpHandler({
  connectionTimeout: 3000,
  requestTimeout: 3000,
});

const undiciDispatcher = new Agent({
  bodyTimeout: 3000,
  headersTimeout: 3000,
  connect: {
    timeout: 3000,
  },
});
const undiciHandler = new UndiciHttpHandler({ dispatcher: undiciDispatcher });

// ---------------------------------------------------------------------------
// 4. Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  port = typeof addr === "object" && addr !== null ? addr.port : 0;

  // Warm up both handlers so first-request setup cost is excluded.
  await drain((await nodeHandler.handle(makeRequest())).response);
  await drain((await undiciHandler.handle(makeRequest())).response);
});

afterAll(() => {
  nodeHandler.destroy();
  undiciHandler.destroy();
  undiciDispatcher.destroy();
  server.close();
});

// ---------------------------------------------------------------------------
// 5. Benchmarks
// ---------------------------------------------------------------------------

describe("10 sequential GETs", () => {
  bench("NodeHttpHandler", async () => {
    for (let i = 0; i < 10; i++) {
      const { response } = await nodeHandler.handle(makeRequest());
      await drain(response);
    }
  });

  bench("UndiciHttpHandler", async () => {
    for (let i = 0; i < 10; i++) {
      const { response } = await undiciHandler.handle(makeRequest());
      await drain(response);
    }
  });
});

describe("50 concurrent GETs", () => {
  bench("NodeHttpHandler", async () => {
    const tasks = Array.from({ length: 50 }, async () => {
      const { response } = await nodeHandler.handle(makeRequest());
      await drain(response);
    });
    await Promise.all(tasks);
  });

  bench("UndiciHttpHandler", async () => {
    const tasks = Array.from({ length: 50 }, async () => {
      const { response } = await undiciHandler.handle(makeRequest());
      await drain(response);
    });
    await Promise.all(tasks);
  });
});
