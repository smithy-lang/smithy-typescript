import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { HttpRequest } from "@smithy/core/protocols";

import { FetchHttpHandler } from "./fetch-http-handler";
import { createSocketTimeoutMonitor } from "./socket-timeout";

/**
 * JS-7140: the fetch-side rolling inactivity monitor. Armed at dispatch (covers
 * the pre-header wait), reset on each download chunk (covers mid-stream stall),
 * aborts via an AbortController. Download direction only.
 */
describe("createSocketTimeoutMonitor (JS-7140)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** A ReadableStream that emits chunks with gapMs between each, under fake timers. */
  const streamWithGaps = (chunks: string[], gapMs: number): ReadableStream<Uint8Array> => {
    let i = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i >= chunks.length) {
          controller.close();
          return;
        }
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(chunks[i++]));
            resolve();
          }, gapMs);
        });
      },
    });
  };

  it("is a no-op when the timeout is non-positive", async () => {
    const m = createSocketTimeoutMonitor(0);
    expect(m.controller.signal.aborted).toBe(false);
    const body = new ReadableStream<Uint8Array>();
    expect(m.monitor(body)).toBe(body); // returns the stream unchanged
    let settled = false;
    void m.timeoutPromise.then(
      () => (settled = true),
      () => (settled = true)
    );
    await vi.advanceTimersByTimeAsync(1_000_000);
    expect(settled).toBe(false);
  });

  it("fires on the pre-header wait: no chunk ever arrives", async () => {
    const m = createSocketTimeoutMonitor(100);
    const rejected = m.timeoutPromise.catch((e) => e);
    await vi.advanceTimersByTimeAsync(100);
    const err = await rejected;
    expect(err).toMatchObject({ name: "TimeoutError" });
    expect(m.controller.signal.aborted).toBe(true);
  });

  it("does not fire while chunks keep arriving inside the window", async () => {
    const m = createSocketTimeoutMonitor(100);
    let timedOut = false;
    void m.timeoutPromise.catch(() => (timedOut = true));

    // Chunks every 60ms, under the 100ms window: a slow but progressing stream.
    const monitored = m.monitor(streamWithGaps(["a", "b", "c"], 60));
    const reader = monitored.getReader();

    const read1 = reader.read();
    await vi.advanceTimersByTimeAsync(60);
    expect((await read1).value).toBeInstanceOf(Uint8Array);
    const read2 = reader.read();
    await vi.advanceTimersByTimeAsync(60);
    await read2;
    const read3 = reader.read();
    await vi.advanceTimersByTimeAsync(60);
    await read3;

    expect(timedOut).toBe(false);
    expect(m.controller.signal.aborted).toBe(false);
  });

  it("fires when the stream stalls longer than the window between chunks", async () => {
    const m = createSocketTimeoutMonitor(100);
    const rejected = m.timeoutPromise.catch((e) => e);

    // A 200ms inter-chunk gap stalls past the 100ms window.
    const monitored = m.monitor(streamWithGaps(["a", "b"], 200));
    const reader = monitored.getReader();
    reader.read();

    await vi.advanceTimersByTimeAsync(100);
    const err = await rejected;
    expect(err).toMatchObject({ name: "TimeoutError" });
    expect(m.controller.signal.aborted).toBe(true);
  });

  it("does not count time the consumer spends not reading (backpressure)", async () => {
    const m = createSocketTimeoutMonitor(100);
    let timedOut = false;
    void m.timeoutPromise.catch(() => (timedOut = true));

    const reader = m.monitor(streamWithGaps(["a", "b"], 10)).getReader();
    await vi.advanceTimersByTimeAsync(10);
    expect((await reader.read()).value).toBeInstanceOf(Uint8Array);
    // The consumer pauses far longer than the window before reading again.
    await vi.advanceTimersByTimeAsync(1000);
    expect(timedOut).toBe(false);
    const next = reader.read();
    await vi.advanceTimersByTimeAsync(10);
    expect((await next).value).toBeInstanceOf(Uint8Array);
    expect(timedOut).toBe(false);
  });

  it("clear() stops a late fire", async () => {
    const m = createSocketTimeoutMonitor(100);
    let timedOut = false;
    void m.timeoutPromise.catch(() => (timedOut = true));
    m.clear();
    await vi.advanceTimersByTimeAsync(1000);
    expect(timedOut).toBe(false);
    expect(m.controller.signal.aborted).toBe(false);
  });

  it("passes the exact input bytes through in order and closes once", async () => {
    // The wrapper's core contract: transparent to data while resetting the timer.
    vi.useRealTimers(); // drain a stream naturally without manual clock control
    const m = createSocketTimeoutMonitor(10_000);
    const input = ["alpha", "beta", "gamma"];
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const s of input) {
          controller.enqueue(new TextEncoder().encode(s));
        }
        controller.close();
      },
    });

    const reader = m.monitor(source).getReader();
    const out: string[] = [];
    let doneCount = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        doneCount++;
        break;
      }
      out.push(new TextDecoder().decode(value));
    }
    m.clear();

    expect(out).toEqual(input); // same bytes, same order, nothing dropped or duplicated
    expect(doneCount).toBe(1); // closed exactly once
  });

  it("aborts via the controller when a caller signal fires (handler forwards to it)", async () => {
    // The handler forwards a caller abort to this controller; prove abort(reason)
    // propagates to the signal the handler passes into fetch.
    const m = createSocketTimeoutMonitor(10_000);
    expect(m.controller.signal.aborted).toBe(false);
    const reason = Object.assign(new Error("Request aborted"), { name: "AbortError" });
    m.controller.abort(reason);
    expect(m.controller.signal.aborted).toBe(true);
    m.clear();
  });

  it("reset() restarts the window", async () => {
    const m = createSocketTimeoutMonitor(100);
    let timedOut = false;
    void m.timeoutPromise.catch(() => (timedOut = true));
    await vi.advanceTimersByTimeAsync(80);
    m.reset();
    await vi.advanceTimersByTimeAsync(80);
    expect(timedOut).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(timedOut).toBe(true);
  });

  it("onSettled runs once on clear()", () => {
    const m = createSocketTimeoutMonitor(100);
    const listener = vi.fn();
    m.onSettled(listener);
    m.clear();
    m.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("onSettled runs when the timer fires", async () => {
    const m = createSocketTimeoutMonitor(100);
    void m.timeoutPromise.catch(() => {});
    const listener = vi.fn();
    m.onSettled(listener);
    await vi.advanceTimersByTimeAsync(100);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("onSettled runs immediately when already settled", () => {
    const m = createSocketTimeoutMonitor(100);
    m.clear();
    const listener = vi.fn();
    m.onSettled(listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("FetchHttpHandler socketTimeout (JS-7140)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("applies an explicit caller socketTimeout", async () => {
    // A fetch that never responds: only the inactivity window can end the request.
    let fetchSignal: AbortSignal | undefined;
    const customFetch = vi.fn((input: RequestInfo | URL) => {
      const request = input as Request;
      fetchSignal = request.signal;
      return new Promise<Response>(() => {});
    });
    const handler = new FetchHttpHandler({ socketTimeout: 100, customFetch });

    const result = handler
      .handle(new HttpRequest({ hostname: "localhost", protocol: "https:", path: "/" }), {})
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(100);

    expect(await result).toMatchObject({ name: "TimeoutError" });
    expect(fetchSignal?.aborted).toBe(true);
  });

  /** A fetch Response stand-in whose streaming body is driven by the request signal. */
  const responseWithStream = (signal: AbortSignal, chunks: string[], gapMs: number) => {
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i >= chunks.length) {
          controller.close();
          return;
        }
        return new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(chunks[i++]));
            resolve();
          }, gapMs);
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(signal.reason);
          });
        });
      },
    });
    return { headers: new Headers(), status: 200, statusText: "OK", body } as unknown as Response;
  };

  it("resets the window when response headers arrive", async () => {
    // Headers at 80ms, first chunk 60ms later: 140ms from dispatch but never 100ms idle.
    const customFetch = vi.fn(
      (input: RequestInfo | URL) =>
        new Promise<Response>((resolve) =>
          setTimeout(() => resolve(responseWithStream((input as Request).signal, ["a"], 60)), 80)
        )
    );
    const handler = new FetchHttpHandler({ socketTimeout: 100, customFetch });

    const pending = handler.handle(new HttpRequest({ hostname: "localhost", protocol: "https:", path: "/" }), {});
    await vi.advanceTimersByTimeAsync(80);
    const { response } = await pending;
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const read = reader.read();
    await vi.advanceTimersByTimeAsync(60);

    expect(new TextDecoder().decode((await read).value)).toBe("a");
  });

  it("a requestInit signal still aborts when the monitor is active", async () => {
    let fetchSignal: AbortSignal | undefined;
    const customFetch = vi.fn((input: RequestInfo | URL) => {
      const request = input as Request;
      fetchSignal = request.signal;
      return Promise.resolve(responseWithStream(request.signal, ["a", "b"], 50));
    });
    const caller = new AbortController();
    const handler = new FetchHttpHandler({
      socketTimeout: 10_000,
      customFetch,
      requestInit: () => ({ signal: caller.signal }),
    });

    const { response } = await handler.handle(
      new HttpRequest({ hostname: "localhost", protocol: "https:", path: "/" }),
      {}
    );
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const read = reader.read().catch((e) => e);
    caller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchSignal?.aborted).toBe(true);
    expect(await read).toMatchObject({ name: "AbortError" });
  });

  it("a caller abort cancels a monitored body mid-download", async () => {
    let fetchSignal: AbortSignal | undefined;
    const customFetch = vi.fn((input: RequestInfo | URL) => {
      const request = input as Request;
      fetchSignal = request.signal;
      return Promise.resolve(responseWithStream(request.signal, ["a", "b"], 50));
    });
    const caller = new AbortController();
    const handler = new FetchHttpHandler({ socketTimeout: 10_000, customFetch });

    const { response } = await handler.handle(
      new HttpRequest({ hostname: "localhost", protocol: "https:", path: "/" }),
      { abortSignal: caller.signal }
    );
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const read = reader.read().catch((e) => e);
    caller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchSignal?.aborted).toBe(true);
    expect(await read).toMatchObject({ name: "AbortError" });
  });
});
