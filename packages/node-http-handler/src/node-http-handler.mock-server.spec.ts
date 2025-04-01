import { AbortController } from "@smithy/abort-controller";
import { HttpRequest } from "@smithy/protocol-http";
import http, { Server as HttpServer } from "http";
import https, { Server as HttpsServer } from "https";
import { AddressInfo } from "net";
import { afterAll, afterEach, beforeAll, describe, expect, test as it, vi } from "vitest";

import { NodeHttpHandler } from "./node-http-handler";
import { ReadFromBuffers } from "./readable.mock";
import {
  createContinueResponseFunction,
  createMirrorResponseFunction,
  createMockHttpServer,
  createMockHttpsServer,
  createResponseFunction,
  getResponseBody,
} from "./server.mock";

vi.mock("http", async () => {
  const actual = (await vi.importActual("http")) as any;
  const pkg = {
    ...actual,
    request: vi.fn().mockImplementation(actual.request),
  };
  return {
    ...pkg,
    default: pkg,
  };
});

vi.mock("https", async () => {
  const actual = (await vi.importActual("https")) as any;
  const pkg = {
    ...actual,
    request: vi.fn().mockImplementation(actual.request),
  };
  return {
    ...pkg,
    default: pkg,
  };
});

import { request as hRequest } from "http";
import { request as hsRequest } from "https";

describe("http", () => {
  let mockHttpServer: HttpServer;
  beforeAll(() => {
    mockHttpServer = createMockHttpServer().listen(54321);
  });

  afterEach(() => {
    mockHttpServer.removeAllListeners("request");
    mockHttpServer.removeAllListeners("checkContinue");
  });

  afterAll(() => {
    mockHttpServer.close();
  });

  it("has metadata", () => {
    const nodeHttpHandler = new NodeHttpHandler();
    expect(nodeHttpHandler.metadata.handlerProtocol).toContain("http/1.1");
  });

  it("can send http requests", async () => {
    const mockResponse = {
      statusCode: 200,
      reason: "OK",
      headers: {},
      body: "test",
    };
    mockHttpServer.addListener("request", createResponseFunction(mockResponse));
    const nodeHttpHandler = new NodeHttpHandler();

    const { response } = await nodeHttpHandler.handle(
      new HttpRequest({
        hostname: "localhost",
        method: "GET",
        port: (mockHttpServer.address() as AddressInfo).port,
        protocol: "http:",
        path: "/",
        headers: {},
      }),
      {}
    );

    expect(response.statusCode).toEqual(mockResponse.statusCode);
    expect(response.reason).toEqual(mockResponse.reason);
    expect(response.headers).toBeDefined();
    expect(response.headers).toMatchObject(mockResponse.headers);
    expect(response.body).toBeDefined();
  });

  [
    { name: "buffer", body: Buffer.from("Buffering🚀") },
    { name: "uint8Array", body: Uint8Array.from(Buffer.from("uint8Array 🚀")) },
    { name: "string", body: Buffer.from("string-test 🚀") },
    { name: "uint8Array subarray", body: Uint8Array.from(Buffer.from("test")).subarray(1, 3) },
    { name: "buffer subarray", body: Buffer.from("test").subarray(1, 3) },
  ].forEach(({ body, name }) => {
    it(`can send requests with bodies ${name}`, async () => {
      const mockResponse = {
        statusCode: 200,
        headers: {},
      };
      mockHttpServer.addListener("request", createMirrorResponseFunction(mockResponse));
      const nodeHttpHandler = new NodeHttpHandler();
      const { response } = await nodeHttpHandler.handle(
        new HttpRequest({
          hostname: "localhost",
          method: "PUT",
          port: (mockHttpServer.address() as AddressInfo).port,
          protocol: "http:",
          path: "/",
          headers: {},
          body,
        }),
        {}
      );

      expect(response.statusCode).toEqual(mockResponse.statusCode);
      expect(response.headers).toBeDefined();
      expect(response.headers).toMatchObject(mockResponse.headers);
      const responseBody = await getResponseBody(response);
      expect(responseBody).toEqual(Buffer.from(body).toString());
    });
  });

  it("can handle expect 100-continue", async () => {
    const body = Buffer.from("test");
    const mockResponse = {
      statusCode: 200,
      headers: {},
    };

    mockHttpServer.addListener("checkContinue", createContinueResponseFunction(mockResponse));
    let endSpy: any;
    let continueWasTriggered = false;
    const spy = vi.mocked(hRequest).mockImplementationOnce(() => {
      const calls = spy.mock.calls;
      const currentIndex = calls.length - 1;
      const request = http.request(calls[currentIndex][0], calls[currentIndex][1]);
      request.on("continue", () => {
        continueWasTriggered = true;
      });
      endSpy = vi.spyOn(request, "end");

      return request;
    });

    const nodeHttpHandler = new NodeHttpHandler();
    const { response } = await nodeHttpHandler.handle(
      new HttpRequest({
        hostname: "localhost",
        method: "PUT",
        port: (mockHttpServer.address() as AddressInfo).port,
        protocol: "http:",
        path: "/",
        headers: {
          Expect: "100-continue",
        },
        body,
      }),
      {}
    );

    expect(response.statusCode).toEqual(mockResponse.statusCode);
    expect(response.headers).toBeDefined();
    expect(response.headers).toMatchObject(mockResponse.headers);
    expect(endSpy!.mock.calls.length).toBe(1);
    expect(endSpy!.mock.calls[0][0]).toStrictEqual(body);
    expect(continueWasTriggered).toBe(true);
  });

  it("can send requests with streaming bodies", async () => {
    const body = new ReadFromBuffers({
      buffers: [Buffer.from("t"), Buffer.from("e"), Buffer.from("s"), Buffer.from("t")],
    });
    const inputBodySpy = vi.spyOn(body, "pipe");
    const mockResponse = {
      statusCode: 200,
      headers: {},
    };
    mockHttpServer.addListener("request", createResponseFunction(mockResponse));
    const nodeHttpHandler = new NodeHttpHandler();

    const { response } = await nodeHttpHandler.handle(
      new HttpRequest({
        hostname: "localhost",
        method: "PUT",
        port: (mockHttpServer.address() as AddressInfo).port,
        protocol: "http:",
        path: "/",
        headers: {},
        body,
      }),
      {}
    );

    expect(response.statusCode).toEqual(mockResponse.statusCode);
    expect(response.headers).toBeDefined();
    expect(response.headers).toMatchObject(mockResponse.headers);
    expect(inputBodySpy.mock.calls.length).toBeTruthy();
  });

  it("can send requests with Uint8Array bodies", async () => {
    const body = Buffer.from([0, 1, 2, 3]);
    const mockResponse = {
      statusCode: 200,
      headers: {},
    };
    mockHttpServer.addListener("request", createResponseFunction(mockResponse));
    let endSpy: any;
    const spy = vi.mocked(hRequest).mockImplementationOnce(() => {
      const calls = spy.mock.calls;
      const currentIndex = calls.length - 1;
      const request = http.request(calls[currentIndex][0], calls[currentIndex][1]);
      endSpy = vi.spyOn(request, "end");
      return request;
    });

    const nodeHttpHandler = new NodeHttpHandler();
    const { response } = await nodeHttpHandler.handle(
      new HttpRequest({
        hostname: "localhost",
        method: "PUT",
        port: (mockHttpServer.address() as AddressInfo).port,
        protocol: "http:",
        path: "/",
        headers: {},
        body,
      }),
      {}
    );

    expect(response.statusCode).toEqual(mockResponse.statusCode);
    expect(response.headers).toBeDefined();
    expect(response.headers).toMatchObject(mockResponse.headers);
    expect(endSpy!.mock.calls.length).toBe(1);
    expect(endSpy!.mock.calls[0][0]).toStrictEqual(body);
  });
});

describe("https", () => {
  const mockHttpsServer: HttpsServer = createMockHttpsServer().listen(54322);

  afterEach(() => {
    mockHttpsServer.removeAllListeners("request");
    mockHttpsServer.removeAllListeners("checkContinue");
  });

  afterAll(() => {
    mockHttpsServer.close();
  });

  it("rejects if the request encounters an error", async () => {
    const mockResponse = {
      statusCode: 200,
      headers: {},
      body: "test",
    };
    mockHttpsServer.addListener("request", createResponseFunction(mockResponse));
    const nodeHttpHandler = new NodeHttpHandler();

    await expect(
      nodeHttpHandler.handle(
        new HttpRequest({
          hostname: "localhost",
          method: "GET",
          port: (mockHttpsServer.address() as AddressInfo).port,
          protocol: "fake:", // trigger a request error
          path: "/",
          headers: {},
        }),
        {}
      )
    ).rejects.toHaveProperty("message");
  });

  it("will not make request if already aborted", async () => {
    const mockResponse = {
      statusCode: 200,
      headers: {},
      body: "test",
    };
    mockHttpsServer.addListener("request", createResponseFunction(mockResponse));
    const spy = vi.mocked(hsRequest).mockImplementationOnce(() => {
      const calls = spy.mock.calls;
      const currentIndex = calls.length - 1;
      return https.request(calls[currentIndex][0], calls[currentIndex][1]);
    });
    // clear data held from previous tests
    spy.mockClear();
    const nodeHttpHandler = new NodeHttpHandler();

    await expect(
      nodeHttpHandler.handle(
        new HttpRequest({
          hostname: "localhost",
          method: "GET",
          port: (mockHttpsServer.address() as AddressInfo).port,
          protocol: "https:",
          path: "/",
          headers: {},
        }),
        {
          abortSignal: {
            aborted: true,
            onabort: null,
          },
        }
      )
    ).rejects.toHaveProperty("name", "AbortError");

    expect(spy.mock.calls.length).toBe(0);
  });

  it(`won't throw uncatchable error in writeRequestBody`, async () => {
    const nodeHttpHandler = new NodeHttpHandler();

    await expect(
      nodeHttpHandler.handle(
        new HttpRequest({
          hostname: "localhost",
          method: "GET",
          port: (mockHttpsServer.address() as AddressInfo).port,
          protocol: "https:",
          path: "/",
          headers: {},
          body: {},
        })
      )
    ).rejects.toHaveProperty("name", "TypeError");
  });

  it("will destroy the request when aborted", async () => {
    const mockResponse = {
      statusCode: 200,
      headers: {},
      body: "test",
    };
    mockHttpsServer.addListener("request", createResponseFunction(mockResponse));
    let httpRequest: http.ClientRequest;
    let reqDestroySpy: any;
    const spy = vi.mocked(hsRequest).mockImplementationOnce(() => {
      const calls = spy.mock.calls;
      const currentIndex = calls.length - 1;
      httpRequest = https.request(calls[currentIndex][0], calls[currentIndex][1]);
      reqDestroySpy = vi.spyOn(httpRequest, "destroy");
      return httpRequest;
    });
    const nodeHttpHandler = new NodeHttpHandler();
    const abortController = new AbortController();

    setTimeout(() => {
      abortController.abort();
    }, 0);

    await expect(
      nodeHttpHandler.handle(
        new HttpRequest({
          hostname: "localhost",
          method: "GET",
          port: (mockHttpsServer.address() as AddressInfo).port,
          protocol: "https:",
          path: "/",
          headers: {},
        }),
        {
          abortSignal: abortController.signal,
        }
      )
    ).rejects.toHaveProperty("name", "AbortError");

    expect(reqDestroySpy.mock.calls.length).toBe(1);
  });
});

describe("configs", () => {
  const mockResponse = {
    statusCode: 200,
    statusText: "OK",
    headers: {},
    body: "test",
  };

  let mockHttpServer: HttpServer;
  let request: HttpRequest;

  beforeAll(() => {
    mockHttpServer = createMockHttpServer().listen(54320);
    request = new HttpRequest({
      hostname: "localhost",
      method: "GET",
      port: (mockHttpServer.address() as AddressInfo).port,
      protocol: "http:",
      path: "/",
      headers: {},
    });
  });

  afterEach(() => {
    mockHttpServer.removeAllListeners("request");
    mockHttpServer.removeAllListeners("checkContinue");
  });

  afterAll(() => {
    mockHttpServer.close();
  });

  it("put HttpClientConfig", async () => {
    mockHttpServer.addListener("request", createResponseFunction(mockResponse));

    const nodeHttpHandler = new NodeHttpHandler();
    const requestTimeout = 200;

    nodeHttpHandler.updateHttpClientConfig("requestTimeout", requestTimeout);

    await nodeHttpHandler.handle(request, {});

    expect(nodeHttpHandler.httpHandlerConfigs().requestTimeout).toEqual(requestTimeout);
  });

  it("update existing HttpClientConfig", async () => {
    mockHttpServer.addListener("request", createResponseFunction(mockResponse));

    const nodeHttpHandler = new NodeHttpHandler({ requestTimeout: 200 });
    const requestTimeout = 300;

    nodeHttpHandler.updateHttpClientConfig("requestTimeout", requestTimeout);

    await nodeHttpHandler.handle(request, {});

    expect(nodeHttpHandler.httpHandlerConfigs().requestTimeout).toEqual(requestTimeout);
  });

  it("httpHandlerConfigs returns empty object if handle is not called", async () => {
    const nodeHttpHandler = new NodeHttpHandler();
    expect(nodeHttpHandler.httpHandlerConfigs()).toEqual({});
  });
});
