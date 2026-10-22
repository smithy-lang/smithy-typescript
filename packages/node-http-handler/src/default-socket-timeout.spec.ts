import http, { type Server as HttpServer } from "node:http";
import type { Http2Server } from "node:http2";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { HttpRequest } from "@smithy/core/protocols";
import { afterAll, afterEach, beforeAll, describe, expect, test as it } from "vitest";

import { NodeHttp2Handler } from "./node-http2-handler";
import { NodeHttpHandler } from "./node-http-handler";
import { createMockHttp2Server } from "./server.mock";
import { resolveDefaultSocketTimeout } from "./set-default-socket-timeout";

/**
 * Generated clients pass a service default idle timeout as the untyped
 * `defaultSocketTimeout` option. NodeHttp2Handler applies it on its own stream idle
 * timer, separate from requestTimeout, unless the caller set an idle timeout. The
 * AWS SDK decides whether to pass it (feature gate); the handler only applies it.
 */

// The default arrives untyped, as it does from generated runtimeConfig providers.
const withDefault = <T extends object>(options: T, defaultSocketTimeout: number) =>
  ({ ...options, defaultSocketTimeout }) as T;

// Real-timer windows with wide margins so a loaded CI event loop cannot flip a result.
const WINDOW = 500; // the service default under test
const PROGRESS_GAP = 150; // well inside the window: progress resets the timer
const STALL_GAP = 800; // well past the window: fires if the default applies

describe("NodeHttp2Handler default socket timeout", () => {
  let server: Http2Server;
  let handler: NodeHttp2Handler | undefined;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Routes: /stall (no headers), /headers-then-stall, /slow?head=&gap=&chunks=, /upload (drain then reply).
  beforeAll(() => {
    server = createMockHttp2Server().listen(0);
    server.on("request", async (req: any, res: any) => {
      const url = new URL(req.url, "http://x");
      const q = (k: string, d: number) => Number(url.searchParams.get(k) ?? d);
      res.on("error", () => {});
      if (url.pathname === "/stall") {
        req.resume();
        return;
      }
      if (url.pathname === "/upload") {
        let bytes = 0;
        req.on("data", (c: Buffer) => (bytes += c.length));
        req.on("end", () => res.end(`received:${bytes}`));
        req.on("error", () => {});
        return;
      }
      req.resume();
      await sleep(q("head", 0));
      res.writeHead(200);
      res.flushHeaders?.();
      if (url.pathname === "/headers-then-stall") {
        return;
      }
      for (let i = 0; i < q("chunks", 3); i++) {
        await sleep(q("gap", 50));
        if (res.destroyed) {
          return;
        }
        res.write(`c${i};`);
      }
      res.end();
    });
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    handler?.destroy();
    handler = undefined;
  });

  const request = (path: string, body?: unknown) => {
    const url = new URL(path, "http://x");
    return new HttpRequest({
      protocol: "http:",
      hostname: "localhost",
      port: (server.address() as AddressInfo).port,
      method: body ? "PUT" : "GET",
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: {},
      body,
    });
  };

  const readBody = (stream: any) =>
    new Promise<string>((resolve, reject) => {
      let out = "";
      stream.on("data", (c: Buffer) => (out += c));
      stream.on("end", () => resolve(out));
      stream.on("error", reject);
    });

  const slowUpload = (chunks: number, gapMs: number) =>
    Readable.from(
      (async function* () {
        for (let i = 0; i < chunks; i++) {
          await sleep(gapMs);
          yield Buffer.from(`u${i};`);
        }
      })()
    );

  const create = (extra: object = {}) =>
    new NodeHttp2Handler(withDefault({ disableConcurrentStreams: true, ...extra }, WINDOW));

  it("times out a stream that never sends headers", async () => {
    handler = create();
    await expect(handler.handle(request("/stall"), {})).rejects.toMatchObject({
      name: "TimeoutError",
      message: `Stream timed out because of no activity for ${WINDOW} ms`,
    });
  });

  it("fails the response body with TimeoutError when the stream stalls after headers", async () => {
    handler = create();
    const { response } = await handler.handle(request("/headers-then-stall"), {});
    await expect(readBody(response.body)).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("keeps a slow but progressing body alive past the window", async () => {
    handler = create();
    const { response } = await handler.handle(request(`/slow?chunks=6&gap=${PROGRESS_GAP}`), {});
    expect(await readBody(response.body)).toBe("c0;c1;c2;c3;c4;c5;");
  });

  it("treats response headers as activity", async () => {
    // Headers at 300ms, first data 300ms later: past the window from dispatch, never idle for it.
    handler = create();
    const { response } = await handler.handle(request("/slow?head=300&gap=300&chunks=2"), {});
    expect(await readBody(response.body)).toBe("c0;c1;");
  });

  it("keeps a slow but progressing upload alive past the window", async () => {
    handler = create();
    const { response } = await handler.handle(request("/upload", slowUpload(6, PROGRESS_GAP)), {});
    expect(await readBody(response.body)).toBe("received:18");
  });

  it("times out a stalled upload with TimeoutError", async () => {
    handler = create();
    await expect(handler.handle(request("/upload", slowUpload(2, STALL_GAP)), {})).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("applies no default when the option is absent", async () => {
    handler = new NodeHttp2Handler({ disableConcurrentStreams: true });
    const { response } = await handler.handle(request(`/slow?chunks=1&gap=${STALL_GAP}`), {});
    expect(await readBody(response.body)).toBe("c0;");
  });

  it("keeps an explicit caller requestTimeout over the service default", async () => {
    handler = create({ requestTimeout: 2000 });
    const { response } = await handler.handle(request(`/slow?chunks=1&gap=${STALL_GAP}`), {});
    expect(await readBody(response.body)).toBe("c0;");
  });

  it("skips the service default when the caller sets sessionTimeout", async () => {
    handler = create({ sessionTimeout: 2000 });
    const { response } = await handler.handle(request(`/slow?chunks=1&gap=${STALL_GAP}`), {});
    expect(await readBody(response.body)).toBe("c0;");
  });

  it("applies the service default to an event stream", async () => {
    // Output-only event streams are not exempt: a gap past the window fails the stream.
    handler = create();
    const { response } = await handler.handle(request(`/slow?chunks=1&gap=${STALL_GAP}`), { isEventStream: true });
    await expect(readBody(response.body)).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("keeps an event stream alive while events arrive within the window", async () => {
    handler = create();
    const { response } = await handler.handle(request(`/slow?chunks=4&gap=${PROGRESS_GAP}`), { isEventStream: true });
    expect(await readBody(response.body)).toBe("c0;c1;c2;c3;");
  });

  it("fails only the stalled stream on a shared session, and the session stays usable", async () => {
    handler = new NodeHttp2Handler(withDefault({}, WINDOW));
    const [stalled, healthy] = await Promise.all([
      handler
        .handle(request("/headers-then-stall"), {})
        .then(({ response }) => readBody(response.body))
        .catch((e) => e),
      handler.handle(request(`/slow?chunks=4&gap=${PROGRESS_GAP}`), {}).then(({ response }) => readBody(response.body)),
    ]);
    expect(stalled).toMatchObject({ name: "TimeoutError" });
    expect(healthy).toBe("c0;c1;c2;c3;");
    const { response } = await handler.handle(request("/slow?chunks=1&gap=10"), {});
    expect(await readBody(response.body)).toBe("c0;");
  });

  it("serves the next request after a timeout on an isolated session", async () => {
    handler = create();
    await expect(handler.handle(request("/stall"), {})).rejects.toMatchObject({ name: "TimeoutError" });
    const { response } = await handler.handle(request("/slow?chunks=1&gap=10"), {});
    expect(await readBody(response.body)).toBe("c0;");
  });

  it("keeps a per-call requestTimeout over the service default", async () => {
    handler = create();
    const { response } = await handler.handle(request(`/slow?chunks=1&gap=${STALL_GAP}`), { requestTimeout: 2000 });
    expect(await readBody(response.body)).toBe("c0;");
  });
});

describe("NodeHttpHandler default socket timeout", () => {
  let server: HttpServer;
  let handler: NodeHttpHandler | undefined;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  beforeAll(() => {
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, "http://x");
      const q = (k: string, d: number) => Number(url.searchParams.get(k) ?? d);
      res.on("error", () => {});
      if (url.pathname === "/upload") {
        let bytes = 0;
        req.on("data", (c: Buffer) => (bytes += c.length));
        req.on("end", () => res.end(`received:${bytes}`));
        req.on("error", () => {});
        return;
      }
      req.resume();
      if (url.pathname === "/stall") {
        return;
      }
      await sleep(q("head", 0));
      res.writeHead(200);
      res.flushHeaders();
      if (url.pathname === "/headers-then-stall") {
        return;
      }
      for (let i = 0; i < q("chunks", 3); i++) {
        await sleep(q("gap", 50));
        if (res.destroyed) {
          return;
        }
        res.write(`c${i};`);
      }
      res.end();
    });
    server.listen(0);
  });

  afterAll(() => {
    server.closeAllConnections?.();
    server.close();
  });

  afterEach(() => {
    handler?.destroy();
    handler = undefined;
  });

  const request = (path: string, body?: unknown) => {
    const url = new URL(path, "http://x");
    return new HttpRequest({
      protocol: "http:",
      hostname: "localhost",
      port: (server.address() as AddressInfo).port,
      method: body ? "PUT" : "GET",
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: {},
      body,
    });
  };

  const slowUpload = (chunks: number, gapMs: number) =>
    Readable.from(
      (async function* () {
        for (let i = 0; i < chunks; i++) {
          await sleep(gapMs);
          yield Buffer.from(`u${i};`);
        }
      })()
    );

  const readBody = (stream: any) =>
    new Promise<string>((resolve, reject) => {
      let out = "";
      stream.on("data", (c: Buffer) => (out += c));
      stream.on("end", () => resolve(out));
      stream.on("error", reject);
    });

  it("times out a stall before headers with TimeoutError", async () => {
    handler = new NodeHttpHandler(withDefault({}, WINDOW));
    await expect(handler.handle(request("/stall"), {})).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("fails the body with TimeoutError when it stalls after headers", async () => {
    handler = new NodeHttpHandler(withDefault({}, WINDOW));
    const { response } = await handler.handle(request("/headers-then-stall"), {});
    await expect(readBody(response.body)).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("keeps a slow but progressing body alive past the window", async () => {
    handler = new NodeHttpHandler(withDefault({}, WINDOW));
    const { response } = await handler.handle(request(`/slow?chunks=6&gap=${PROGRESS_GAP}`), {});
    expect(await readBody(response.body)).toBe("c0;c1;c2;c3;c4;c5;");
  });

  it("keeps a slow but progressing upload alive past the window", async () => {
    handler = new NodeHttpHandler(withDefault({}, WINDOW));
    const { response } = await handler.handle(request("/upload", slowUpload(6, PROGRESS_GAP)), {});
    expect(await readBody(response.body)).toBe("received:18");
  });

  it("times out a stalled upload with TimeoutError", async () => {
    handler = new NodeHttpHandler(withDefault({}, WINDOW));
    await expect(handler.handle(request("/upload", slowUpload(2, STALL_GAP)), {})).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("keeps an explicit caller socketTimeout over the service default", async () => {
    handler = new NodeHttpHandler(withDefault({ socketTimeout: 2000 }, WINDOW));
    const { response } = await handler.handle(request(`/slow?chunks=1&gap=${STALL_GAP}`), {});
    expect(await readBody(response.body)).toBe("c0;");
  });

  it("applies no default when the option is absent", async () => {
    handler = new NodeHttpHandler({});
    const { response } = await handler.handle(request(`/slow?chunks=1&gap=${STALL_GAP}`), {});
    expect(await readBody(response.body)).toBe("c0;");
  });

  it("ignores an invalid default set through updateHttpClientConfig", async () => {
    // The response outlives setSocketTimeout's 3 s deferral, where -1 would reach
    // socket.setTimeout and throw ERR_OUT_OF_RANGE if it were not re-validated.
    handler = new NodeHttpHandler(withDefault({}, 300000));
    handler.updateHttpClientConfig("defaultSocketTimeout" as any, -1 as any);
    const { response } = await handler.handle(request("/slow?chunks=1&gap=3500"), {});
    expect(await readBody(response.body)).toBe("c0;");
  }, 10_000);

  it("reuses a pooled socket after the window has passed", async () => {
    handler = new NodeHttpHandler(withDefault({}, WINDOW));
    const first = await handler.handle(request("/slow?chunks=1&gap=10"), {});
    expect(await readBody(first.response.body)).toBe("c0;");
    await sleep(WINDOW + 300);
    const second = await handler.handle(request("/slow?chunks=1&gap=10"), {});
    expect(await readBody(second.response.body)).toBe("c0;");
  });
});

describe("resolveDefaultSocketTimeout", () => {
  it("returns a finite positive timeout", () => {
    expect(resolveDefaultSocketTimeout({ defaultSocketTimeout: 300000 })).toBe(300000);
  });

  it.each([0, -1, Infinity, -Infinity, NaN, "300000", null, undefined])("ignores %p", (value) => {
    expect(resolveDefaultSocketTimeout({ defaultSocketTimeout: value })).toBeUndefined();
  });

  it("ignores missing config", () => {
    expect(resolveDefaultSocketTimeout(undefined)).toBeUndefined();
    expect(resolveDefaultSocketTimeout({})).toBeUndefined();
  });
});
