import { randomBytes } from "node:crypto";
import http2, { type Http2SecureServer, type ServerHttp2Stream } from "node:http2";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { generate as generatePem } from "@metcoder95/https-pem";
import { HttpRequest } from "@smithy/core/protocols";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UndiciHttpHandler } from "./undici-http-handler";

/**
 * Reads a length-prefixed framed stream and returns parsed JSON events.
 * Frame format: 4-byte big-endian length + JSON payload.
 */
async function readFramedEvents(body: Readable): Promise<unknown[]> {
  const events: unknown[] = [];
  let buffer = Buffer.alloc(0);
  for await (const chunk of body) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const frameLength = buffer.readUInt32BE(0);
      if (buffer.length < 4 + frameLength) break;
      events.push(JSON.parse(buffer.subarray(4, 4 + frameLength).toString()));
      buffer = buffer.subarray(4 + frameLength);
    }
  }
  return events;
}

/** Writes a length-prefixed frame to an HTTP/2 stream. */
function writeFrame(stream: ServerHttp2Stream, data: unknown): void {
  const payload = Buffer.from(JSON.stringify(data));
  const frame = Buffer.alloc(4 + payload.length);
  frame.writeUInt32BE(payload.length, 0);
  payload.copy(frame, 4);
  stream.write(frame);
}

describe("UndiciHttpHandler HTTP/1.1 integration", () => {
  let httpServer: Server;
  let httpPort: number;
  let handler: UndiciHttpHandler;

  beforeAll(async () => {
    httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url!, `http://localhost`);

      if (url.pathname === "/echo") {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          const body = Buffer.concat(chunks);
          res.writeHead(200, {
            "content-type": req.headers["content-type"] ?? "application/octet-stream",
            "content-length": String(body.length),
          });
          res.end(body);
        });
        return;
      }

      if (url.pathname === "/stream-response") {
        res.writeHead(200, { "content-type": "application/octet-stream" });
        const chunks = ["chunk1", "chunk2", "chunk3"];
        let i = 0;
        const interval = setInterval(() => {
          if (i < chunks.length) {
            res.write(chunks[i++]);
          } else {
            clearInterval(interval);
            res.end();
          }
        }, 10);
        return;
      }

      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => {
        httpPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });

    handler = new UndiciHttpHandler();
  });

  afterAll(async () => {
    handler?.destroy();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  function createRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
    return Object.assign(
      new HttpRequest({
        protocol: "http:",
        hostname: "127.0.0.1",
        port: httpPort,
        method: "GET",
        path: "/",
        headers: {},
      }),
      overrides
    );
  }

  const data = randomBytes(16 * 1024);

  it.each([
    { type: "string", body: () => data.toString("base64") },
    { type: "Buffer", body: () => Buffer.from(data) },
    { type: "Uint8Array", body: () => new Uint8Array(data) },
    { type: "Readable", body: () => Readable.from(data) },
  ])("sends and receives $type body", async ({ body }) => {
    const content = body();
    const contentLength = Buffer.byteLength(content instanceof Readable ? data : (content as any));
    const { response } = await handler.handle(
      createRequest({
        method: "PUT",
        path: "/echo",
        headers: { "content-type": "application/octet-stream", "content-length": String(contentLength) },
        body: content,
      })
    );

    expect(response.statusCode).toBe(200);
    const received = Buffer.from(await new Response(response.body).arrayBuffer());
    expect(received).toEqual(content instanceof Readable ? data : Buffer.from(content as any));
  });

  it("consumes a chunked streaming response", async () => {
    const { response } = await handler.handle(createRequest({ path: "/stream-response" }));

    expect(response.statusCode).toBe(200);
    const received = await new Response(response.body).text();
    expect(received).toBe("chunk1chunk2chunk3");
  });
});

describe("UndiciHttpHandler HTTP/2 integration", () => {
  let h2Server: Http2SecureServer;
  let h2Port: number;
  let handler: UndiciHttpHandler;

  beforeAll(async () => {
    const tlsOptions = await generatePem({ opts: { keySize: 2048 } });

    h2Server = http2.createSecureServer(tlsOptions);

    h2Server.on("stream", (stream: ServerHttp2Stream, headers: Record<string, string | string[] | undefined>) => {
      const path = headers[":path"] as string;

      if (path === "/echo") {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          const body = Buffer.concat(chunks);
          stream.respond({ ":status": 200, "content-length": String(body.length) });
          stream.end(body);
        });
        return;
      }

      if (path === "/streaming") {
        stream.respond({ ":status": 200, "content-type": "application/octet-stream" });
        const events = [{ type: "start" }, { type: "data", value: 1 }, { type: "data", value: 2 }];
        let i = 0;
        const interval = setInterval(() => {
          if (i < events.length) {
            writeFrame(stream, events[i++]);
          } else {
            clearInterval(interval);
            stream.end();
          }
        }, 10);
        return;
      }

      if (path === "/bidirectional") {
        stream.respond({ ":status": 200, "content-type": "application/octet-stream" });
        stream.on("data", (chunk: Buffer) => writeFrame(stream, { echo: chunk.toString() }));
        stream.on("end", () => {
          writeFrame(stream, { done: true });
          stream.end();
        });
        return;
      }

      stream.respond({ ":status": 200 });
      stream.end("ok");
    });

    await new Promise<void>((resolve) => {
      h2Server.listen(0, "127.0.0.1", () => {
        h2Port = (h2Server.address() as AddressInfo).port;
        resolve();
      });
    });

    handler = new UndiciHttpHandler({ dispatcher: { connect: { rejectUnauthorized: false } } });
  });

  afterAll(async () => {
    handler?.destroy();
    if (h2Server) {
      await new Promise<void>((resolve, reject) => {
        h2Server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  function createRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
    return Object.assign(
      new HttpRequest({
        protocol: "https:",
        hostname: "127.0.0.1",
        port: h2Port,
        method: "GET",
        path: "/",
        headers: {},
      }),
      overrides
    );
  }

  it("sends and receives body over HTTP/2", async () => {
    const data = randomBytes(8 * 1024);
    const { response } = await handler.handle(
      createRequest({
        method: "POST",
        path: "/echo",
        headers: { "content-type": "application/octet-stream" },
        body: data,
      })
    );

    expect(response.statusCode).toBe(200);
    const received = Buffer.from(await new Response(response.body).arrayBuffer());
    expect(received).toEqual(data);
  });

  it("consumes a streaming response over HTTP/2", async () => {
    const { response } = await handler.handle(createRequest({ path: "/streaming" }));

    expect(response.statusCode).toBe(200);
    const events = await readFramedEvents(response.body as Readable);
    expect(events).toEqual([{ type: "start" }, { type: "data", value: 1 }, { type: "data", value: 2 }]);
  });

  it("supports bidirectional streaming over HTTP/2", async () => {
    const inputStream = Readable.from(["hello", "world"].map((s) => Buffer.from(s)));
    const { response } = await handler.handle(
      createRequest({
        method: "POST",
        path: "/bidirectional",
        headers: { "content-type": "application/octet-stream" },
        body: inputStream,
      })
    );

    expect(response.statusCode).toBe(200);
    const events = await readFramedEvents(response.body as Readable);
    expect(events[events.length - 1]).toEqual({ done: true });
    expect(events.filter((e: any) => e.echo)).toHaveLength(2);
  });
});
