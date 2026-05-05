import { Readable } from "node:stream";
import { cbor } from "@smithy/core/cbor";
import { HttpResponse, type HttpHandler } from "@smithy/core/protocols";
import { describe, expect, test as it } from "vitest";
import { GetNumbersCommand, XYZService } from "xyz-schema";

import { Retry } from "./util-retry/retries-2026-config";

Retry.v2026 = true;

class ThrottlingHandler implements HttpHandler {
  public readonly metadata = { handlerProtocol: "http/1.1" };
  public timestamps: number[] = [];

  private static okBody = cbor.serialize({});
  private static throttleBody = cbor.serialize({ __type: "ThrottlingException", message: "Rate exceeded" });

  private ratePerSecond: number;
  private tokens: number;
  private lastRefillMs: number;

  public constructor(ratePerSecond: number) {
    this.ratePerSecond = ratePerSecond;
    this.tokens = ratePerSecond;
    this.lastRefillMs = performance.now();
  }

  public updateHttpClientConfig(key: never, value: never): void {
    throw new Error("Method not implemented.");
  }

  public httpHandlerConfigs(): {} {
    throw new Error("Method not implemented.");
  }

  public setRate(rps: number) {
    this.refill();
    this.ratePerSecond = rps;
    this.tokens = Math.min(this.tokens, rps);
  }

  public async handle() {
    this.refill();
    this.timestamps.push(performance.now());

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return {
        response: new HttpResponse({
          statusCode: 200,
          headers: { "smithy-protocol": "rpc-v2-cbor" },
          body: Readable.from(ThrottlingHandler.okBody),
        }),
      };
    }

    return {
      response: new HttpResponse({
        statusCode: 429,
        headers: { "smithy-protocol": "rpc-v2-cbor" },
        body: Readable.from(ThrottlingHandler.throttleBody),
      }),
    };
  }

  public rpsInInterval(startMs: number, endMs: number): number {
    const count = this.timestamps.filter((t) => t >= startMs && t < endMs).length;
    const durationSeconds = (endMs - startMs) / 1000;
    return durationSeconds > 0 ? count / durationSeconds : 0;
  }

  private refill() {
    const now = performance.now();
    const elapsedSeconds = (now - this.lastRefillMs) / 1000;
    this.tokens = Math.min(this.ratePerSecond, this.tokens + elapsedSeconds * this.ratePerSecond);
    this.lastRefillMs = now;
  }
}

function createClient(handler: ThrottlingHandler) {
  return new XYZService({
    endpoint: "https://localhost",
    apiKey: { apiKey: "test" },
    retryMode: "adaptive",
    maxAttempts: 4,
    requestHandler: handler,
  });
}

async function continuousInvoke(
  client: XYZService,
  maxDurationMs: number,
  workers: number,
  signal: AbortSignal
): Promise<void> {
  const deadline = performance.now() + maxDurationMs;
  const worker = async () => {
    while (performance.now() < deadline && !signal.aborted) {
      try {
        await client.send(new GetNumbersCommand({}));
      } catch {
        // throttling errors expected
      }
    }
  };
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

/**
 * Polls the handler's RPS every 500ms. Resolves once the measured RPS
 * over the last `windowMs` falls within [lower, upper], or when
 * `maxWaitMs` elapses.
 */
async function waitForRpsInRange(
  handler: ThrottlingHandler,
  lower: number,
  upper: number,
  maxWaitMs: number,
  windowMs = 2000
): Promise<void> {
  const deadline = performance.now() + maxWaitMs;
  while (performance.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    const now = performance.now();
    const rps = handler.rpsInInterval(now - windowMs, now);
    if (rps >= lower && rps <= upper) return;
  }
}

describe("adaptive retry rate targeting", () => {
  const THROTTLE_RPS = 20;

  it("converges send rate to match server throttle (20 RPS)", async () => {
    const handler = new ThrottlingHandler(THROTTLE_RPS);
    const client = createClient(handler);
    const abort = new AbortController();

    const lower = THROTTLE_RPS * 0.5;
    const upper = THROTTLE_RPS * 1.5;

    const invoke = continuousInvoke(client, 30_000, 10, abort.signal);
    await waitForRpsInRange(handler, lower, upper, 15_000);

    const now = performance.now();
    const measuredRps = handler.rpsInInterval(now - 2000, now);

    abort.abort();
    await invoke;

    expect(measuredRps).toBeGreaterThanOrEqual(lower);
    expect(measuredRps).toBeLessThanOrEqual(upper);
  }, 30_000);

  it("reduces send rate when server throttle drops (10k -> 10 RPS)", async () => {
    const REDUCED_RPS = 10;
    const lower = REDUCED_RPS * 0.3;
    const upper = REDUCED_RPS * 2;

    const handler = new ThrottlingHandler(10_000);
    const client = createClient(handler);
    const abort = new AbortController();

    setTimeout(() => handler.setRate(REDUCED_RPS), 3000);

    const invoke = continuousInvoke(client, 30_000, 10, abort.signal);
    await new Promise((r) => setTimeout(r, 3500));
    await waitForRpsInRange(handler, lower, upper, 12_000);

    const now = performance.now();
    const measuredRps = handler.rpsInInterval(now - 2000, now);

    abort.abort();
    await invoke;

    expect(measuredRps).toBeGreaterThanOrEqual(lower);
    expect(measuredRps).toBeLessThanOrEqual(upper);
  }, 30_000);

  it("recovers send rate after temporary throttle blip (10k -> 20 -> 10k RPS)", async () => {
    const handler = new ThrottlingHandler(10_000);
    const client = createClient(handler);
    const abort = new AbortController();

    setTimeout(() => handler.setRate(20), 2000);
    setTimeout(() => handler.setRate(10_000), 4000);

    const invoke = continuousInvoke(client, 15_000, 5, abort.signal);
    await invoke;

    const now = performance.now();
    const recoveryRps = handler.rpsInInterval(now - 3000, now);
    expect(recoveryRps).toBeGreaterThan(20);
  }, 25_000);
});
