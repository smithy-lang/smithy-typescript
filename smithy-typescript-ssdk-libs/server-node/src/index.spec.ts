/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp } from "fs/promises";
import type { IncomingMessage, RequestOptions, Server, ServerResponse } from "http";
import { createServer, request } from "http";
import * as os from "os";
import * as path from "path";
import type { Readable } from "stream";

import { convertRequest } from "./node";

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
      // From LTS 18 -> 20, the connection header defaults from "close" to "keep-alive", so don't test explicitly
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
      // From LTS 18 -> 20, the connection header defaults from "close" to "keep-alive", so don't test explicitly
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
      // From LTS 18 -> 20, the connection header defaults from "close" to "keep-alive", so don't test explicitly
    });
    expect(await streamToString(convertedReq.body)).toEqual("");
  });
});

// TODO Implement writeResponse tests
// describe("writeResponse", () => {
//   it("converts a simple GET / correctly", async () => {});
// });
