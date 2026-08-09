/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import http, { type IncomingMessage, type RequestOptions, type Server, type ServerResponse } from "node:http";
const { createServer, request } = http;
import * as os from "node:os";
import * as path from "node:path";
import type { Readable } from "node:stream";

import { convertRequest, writeResponse } from "./node-http-converters";

let socketPath: string;
let promiseResolve: ([req, res]: [IncomingMessage, ServerResponse]) => void;

let server: Server;
beforeAll(async () => {
  server = createServer(function (req, res) {
    promiseResolve([req, res]);
    resToEnd = res;
  });
  // Create a temporary named pipe where to run the server and obtain a request
  socketPath = path.join(await mkdtemp(path.join(os.tmpdir(), "named-pipe-for-test-")), "server");
  // TODO Add support to Windows by using '\\\\?\\pipe'
  // See: https://nodejs.org/api/net.html#identifying-paths-for-ipc-connections
  server.listen(socketPath);
});

let resToEnd: ServerResponse;

function getRequest(options: RequestOptions & { body?: string }): Promise<[IncomingMessage, ServerResponse]> {
  return new Promise((resolve) => {
    promiseResolve = resolve;
    request({
      socketPath,
      ...options,
    }).end(Buffer.from(options.body || []));
  });
}

afterAll(() => {
  server?.close();
});

async function streamToString(stream: Readable) {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

describe("convertRequest", () => {
  afterEach(async () => {
    resToEnd?.end();
  });
  it("converts a simple GET / correctly", async () => {
    const [req] = await getRequest({
      host: "example.com",
      path: "/",
    });

    const convertedReq = convertRequest(req);
    expect(convertedReq.hostname).toEqual("example.com");
    expect(convertedReq.method).toEqual("GET");
    expect(convertedReq.path).toEqual("/");
    expect(convertedReq.protocol).toEqual("http:");
    expect(convertedReq.query).toEqual({});
    expect(convertedReq.headers).toMatchObject({
      host: "example.com",
    });
    expect(await streamToString(convertedReq.body)).toEqual("");
  });
  it("converts a POST with query string correctly", async () => {
    const [req] = await getRequest({
      method: "POST",
      host: "example.com",
      path: "/some/endpoint?q=hello&a=world",
      body: "hello",
    });

    const convertedReq = convertRequest(req);
    expect(convertedReq.hostname).toEqual("example.com");
    expect(convertedReq.method).toEqual("POST");
    expect(convertedReq.path).toEqual("/some/endpoint");
    expect(convertedReq.protocol).toEqual("http:");
    expect(convertedReq.query).toEqual({
      q: "hello",
      a: "world",
    });
    expect(convertedReq.headers).toMatchObject({
      host: "example.com",
      "content-length": "5",
    });
    expect(await streamToString(convertedReq.body)).toEqual("hello");
  });
  it("converts OPTIONS CORS requests", async () => {
    const [req] = await getRequest({
      method: "OPTIONS",
      host: "example.com",
      path: "/some/resource",
      headers: {
        "Access-Control-Request-Method": "DELETE",
        "Access-Control-Request-Headers": "origin, x-requested-with",
        Origin: "https://example.com",
      },
    });
    const convertedReq = convertRequest(req);
    expect(convertedReq.hostname).toEqual("example.com");
    expect(convertedReq.method).toEqual("OPTIONS");
    expect(convertedReq.path).toEqual("/some/resource");
    expect(convertedReq.protocol).toEqual("http:");
    expect(convertedReq.query).toEqual({});
    expect(convertedReq.headers).toMatchObject({
      "access-control-request-headers": "origin, x-requested-with",
      "access-control-request-method": "DELETE",
      origin: "https://example.com",
      host: "example.com",
    });
    expect(await streamToString(convertedReq.body)).toEqual("");
  });
  it("preserves multi-value query parameters", async () => {
    const [req] = await getRequest({
      host: "example.com",
      path: "/search?tag=a&tag=b&tag=c&single=one",
    });
    const convertedReq = convertRequest(req);
    expect(convertedReq.query).toEqual({
      tag: ["a", "b", "c"],
      single: "one",
    });
  });
  it("omits undefined header values", async () => {
    const [req] = await getRequest({
      host: "example.com",
      path: "/",
    });
    const convertedReq = convertRequest(req);
    for (const value of Object.values(convertedReq.headers)) {
      expect(value).not.toBeUndefined();
    }
  });
});

describe("writeResponse", () => {
  let writeServer: Server;
  let writeSocketPath: string;

  beforeAll(async () => {
    writeSocketPath = path.join(await mkdtemp(path.join(os.tmpdir(), "write-response-test-")), "server");
  });

  afterAll(() => {
    writeServer?.close();
  });

  function startServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<void> {
    return new Promise((resolve) => {
      writeServer = createServer(handler);
      writeServer.listen(writeSocketPath, resolve);
    });
  }

  function makeResponse(
    options: RequestOptions = {}
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
    return new Promise((resolve, reject) => {
      const req = request({ socketPath: writeSocketPath, ...options }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode!,
            headers: res.headers as Record<string, string>,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      });
      req.on("error", reject);
      req.end();
    });
  }

  it("writes status code, headers, and body", async () => {
    await startServer((_req, res) => {
      writeResponse(
        { statusCode: 200, headers: { "content-type": "application/json" }, body: '{"ok":true}' } as any,
        res
      );
    });

    const result = await makeResponse();
    expect(result.statusCode).toBe(200);
    expect(result.headers["content-type"]).toBe("application/json");
    expect(result.body).toBe('{"ok":true}');
  });

  it("handles undefined body without crashing", async () => {
    writeServer?.close();
    writeSocketPath = path.join(await mkdtemp(path.join(os.tmpdir(), "write-response-test-")), "server");
    await startServer((_req, res) => {
      writeResponse({ statusCode: 204, headers: {}, body: undefined } as any, res);
    });

    const result = await makeResponse();
    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
  });

  it("returns 500 when httpResponse is falsy", async () => {
    writeServer?.close();
    writeSocketPath = path.join(await mkdtemp(path.join(os.tmpdir(), "write-response-test-")), "server");
    await startServer((_req, res) => {
      writeResponse(undefined as any, res);
    });

    const result = await makeResponse();
    expect(result.statusCode).toBe(500);
    expect(result.body).toBe("Error processing request");
  });
});
