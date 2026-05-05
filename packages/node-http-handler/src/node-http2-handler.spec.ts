import { rejects } from "node:assert";
import http2, {
  constants,
  type ClientHttp2Session,
  type ClientHttp2Stream,
  type Http2Server,
  type Http2Session,
  type Http2Stream,
} from "node:http2";
import { Duplex } from "node:stream";
import { promisify } from "node:util";
import { AbortController as AbortControllerPolyfill } from "@smithy/abort-controller";
import { HttpRequest, type HttpResponse } from "@smithy/core/protocols";
import type { Mutable } from "@smithy/types";
import getPort, { portNumbers } from "get-port";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import type { ClientHttp2SessionRef } from "./http2/ClientHttp2SessionRef";
import type { NodeHttp2ConnectionManager } from "./node-http2-connection-manager";
import { NodeHttp2ConnectionPool } from "./node-http2-connection-pool";
import { NodeHttp2Handler, type NodeHttp2HandlerOptions } from "./node-http2-handler";
import { createMockHttp2Server, createResponseFunction, createResponseFunctionWithDelay } from "./server.mock";
import { timing } from "./timing";

const getConnectionManager = (handler: NodeHttp2Handler) =>
  (handler as any).connectionManager as NodeHttp2ConnectionManager;

const getConnectionPools = (handler: NodeHttp2Handler) =>
  (getConnectionManager(handler) as any).connectionPools as Map<string, NodeHttp2ConnectionPool>;

const getSessions = (handler: NodeHttp2Handler, authority: string) =>
  (getConnectionPools(handler).get(authority) as any).sessions as ClientHttp2SessionRef[];

const getFirstSession = (handler: NodeHttp2Handler, authority: string) => getSessions(handler, authority)[0];

describe(NodeHttp2Handler.name, () => {
  let nodeH2Handler: NodeHttp2Handler;

  const protocol = "http:";
  const hostname = "localhost";
  let port1: number = 0;
  let port2: number = 0;
  let port3: number = 0;
  let port4: number = 0;

  let mockH2Server: any = undefined;
  const mockH2Servers: Record<string, Http2Server> = {};

  let authority: string;
  const getMockReqOptions = () => ({
    protocol,
    hostname,
    port: port1,
    method: "GET",
    path: "/",
    headers: {},
  });

  const mockResponse = {
    statusCode: 200,
    headers: {},
    body: "test",
  };

  beforeEach(async () => {
    for (let i = 0; i < 4; ++i) {
      const port = await getPort({ port: portNumbers(45_341, 50_000) });
      mockH2Servers[port] = createMockHttp2Server().listen(port);
    }

    [port1, port2, port3, port4] = Object.keys(mockH2Servers).map(Number);
    authority = `${protocol}//${hostname}:${port1}/`;

    mockH2Server = mockH2Servers[port1];
    mockH2Server.on("request", createResponseFunction(mockResponse));
  });

  afterEach(() => {
    mockH2Server.removeAllListeners("request");
    vi.clearAllMocks();
    for (const p in mockH2Servers) {
      mockH2Servers[p].removeAllListeners("request");
      mockH2Servers[p].close();
    }
    Object.keys(mockH2Servers).forEach((key) => {
      delete mockH2Servers[key];
    });
  });

  describe.each([
    ["undefined", undefined],
    ["empty object", {}],
    ["undefined provider", async () => void 0],
    ["empty object provider", async () => ({})],
  ])("without options in constructor parameter of %s", (_, option) => {
    let createdSessions!: ClientHttp2Session[];
    const connectReal = http2.connect;
    let connectSpy!: typeof http2.connect;

    beforeEach(() => {
      createdSessions = [];
      connectSpy = vi.spyOn(http2, "connect").mockImplementation((...args: any[]) => {
        const session = connectReal(args[0], args[1]);
        vi.spyOn(session, "ref");
        vi.spyOn(session, "unref");
        vi.spyOn(session, "settings");
        createdSessions.push(session);
        return session;
      }) as any;

      nodeH2Handler = new NodeHttp2Handler(option);
    });

    const closeConnection = async (response: HttpResponse) => {
      const responseBody = response.body as ClientHttp2Stream;
      const closePromise = new Promise((resolve) => responseBody.once("close", resolve));
      responseBody.destroy();
      await closePromise;
    };

    // Keeping node alive while request is open.
    // With ref-counting: constructor calls unref once, each get() calls ref once.
    const expectSessionCreatedAndReferred = (session: ClientHttp2Session, requestCount = 1) => {
      expect(session.ref).toHaveBeenCalledTimes(requestCount);
      expect(session.unref).toHaveBeenCalledTimes(1); // initial unref in constructor
    };

    // No longer keeping node alive.
    // With ref-counting: constructor calls unref once, each get() calls ref once,
    // free() calls unref when refcount reaches zero.
    const expectSessionCreatedAndUnreffed = (session: ClientHttp2Session, requestCount = 1) => {
      expect(session.ref).toHaveBeenCalledTimes(requestCount);
      // 1 (constructor) + 1 (final free reaching zero)
      expect(session.unref).toHaveBeenCalledTimes(2);
    };

    // Session was destroyed (e.g. goaway/error), free() is a no-op on destroyed sessions.
    const expectSessionCreatedAndDestroyed = (session: ClientHttp2Session, requestCount = 1) => {
      expect(session.ref).toHaveBeenCalledTimes(requestCount);
      expect(session.unref).toHaveBeenCalledTimes(1); // only constructor unref
    };

    afterEach(() => {
      nodeH2Handler.destroy();
    });

    it("has metadata", () => {
      expect(nodeH2Handler.metadata.handlerProtocol).toContain("h2");
    });

    describe("number calls to http2.connect", () => {
      it("is zero on initialization", () => {
        expect(connectSpy).not.toHaveBeenCalled();
      });

      it("is one when request is made", async () => {
        // Make single request.
        const { response } = await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

        expect(connectSpy).toHaveBeenCalledTimes(1);
        expect(connectSpy).toHaveBeenCalledWith(authority);

        expectSessionCreatedAndReferred(createdSessions[0]);
        await closeConnection(response);
        expectSessionCreatedAndUnreffed(createdSessions[0]);
      });

      it("is one if multiple requests are made on same URL", async () => {
        const connectSpy = vi.spyOn(http2, "connect");

        // Make two requests.
        const { response: response1 } = await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});
        const { response: response2 } = await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

        expect(connectSpy).toHaveBeenCalledTimes(1);
        expect(connectSpy).toHaveBeenCalledWith(authority);

        expectSessionCreatedAndReferred(createdSessions[0], 2);
        await closeConnection(response1);
        await closeConnection(response2);
        expectSessionCreatedAndUnreffed(createdSessions[0], 2);
      });

      it("is many if requests are made on different URLs", async () => {
        const connectSpy = vi.spyOn(http2, "connect");

        // Make first request on default URL.
        const { response: response1 } = await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

        const mockH2Server2 = mockH2Servers[port2];
        mockH2Server2.on("request", createResponseFunction(mockResponse));

        // Make second request on URL with port2.
        const { response: response2 } = await nodeH2Handler.handle(
          new HttpRequest({ ...getMockReqOptions(), port: port2 }),
          {}
        );

        const authorityPrefix = `${protocol}//${hostname}`;
        expect(connectSpy).toHaveBeenCalledTimes(2);
        expect(connectSpy).toHaveBeenNthCalledWith(1, `${authorityPrefix}:${port1}/`);
        expect(connectSpy).toHaveBeenNthCalledWith(2, `${authorityPrefix}:${port2}/`);
        mockH2Server2.close();

        expectSessionCreatedAndReferred(createdSessions[0]);
        expectSessionCreatedAndReferred(createdSessions[1]);
        await closeConnection(response1);
        await closeConnection(response2);
        expectSessionCreatedAndUnreffed(createdSessions[0]);
        expectSessionCreatedAndUnreffed(createdSessions[1]);
      });
    });

    describe("errors", () => {
      const UNEXPECTEDLY_CLOSED_REGEX = /closed|destroy|cancel|did not get a response|failed/i;
      it("handles goaway frames", async () => {
        const mockH2Server3 = mockH2Servers[port3];
        let establishedConnections = 0;
        let numRequests = 0;
        let shouldSendGoAway = true;

        mockH2Server3.on("stream", (request: Http2Stream) => {
          // transmit goaway frame without shutting down the connection
          // to simulate an unlikely error mode.
          numRequests += 1;
          if (shouldSendGoAway) {
            request.session!.goaway(constants.NGHTTP2_PROTOCOL_ERROR);
          }
        });
        mockH2Server3.on("connection", () => {
          establishedConnections += 1;
        });
        const req = new HttpRequest({ ...getMockReqOptions(), port: port3 });
        expect(establishedConnections).toBe(0);
        expect(numRequests).toBe(0);
        await rejects(
          nodeH2Handler.handle(req, {}),
          UNEXPECTEDLY_CLOSED_REGEX,
          "should be rejected promptly due to goaway frame"
        );
        expect(establishedConnections).toBe(1);
        expect(numRequests).toBe(1);
        await rejects(
          nodeH2Handler.handle(req, {}),
          UNEXPECTEDLY_CLOSED_REGEX,
          "should be rejected promptly due to goaway frame"
        );
        expect(establishedConnections).toBe(2);
        expect(numRequests).toBe(2);
        await rejects(
          nodeH2Handler.handle(req, {}),
          UNEXPECTEDLY_CLOSED_REGEX,
          "should be rejected promptly due to goaway frame"
        );
        expect(establishedConnections).toBe(3);
        expect(numRequests).toBe(3);

        // Not keeping node alive
        expect(createdSessions).toHaveLength(3);
        expectSessionCreatedAndDestroyed(createdSessions[0]);
        expectSessionCreatedAndDestroyed(createdSessions[1]);
        expectSessionCreatedAndDestroyed(createdSessions[2]);

        // should be able to recover from goaway after reconnecting to a server
        // that doesn't send goaway, and reuse the TCP connection (Http2Session)
        shouldSendGoAway = false;
        mockH2Server3.on("request", createResponseFunction(mockResponse));
        const result = await nodeH2Handler.handle(req, {});
        const resultReader = result.response.body;

        // Keeping node alive
        expect(createdSessions).toHaveLength(4);
        expectSessionCreatedAndReferred(createdSessions[3]);

        // ...and validate that the mocked response is received
        const responseBody = await new Promise((resolve) => {
          const buffers: any[] = [];
          resultReader.on("data", (chunk: any) => buffers.push(chunk));
          resultReader.on("close", () => {
            resolve(Buffer.concat(buffers).toString("utf8"));
          });
        });
        expect(responseBody).toBe("test");
        expect(establishedConnections).toBe(4);
        expect(numRequests).toBe(4);
        mockH2Server3.close();

        // Not keeping node alive
        expect(createdSessions).toHaveLength(4);
        expectSessionCreatedAndUnreffed(createdSessions[3]);
      });

      it("handles servers calling connections destroy", async () => {
        const port = port2;
        const mockH2Server4 = mockH2Servers[port];
        let establishedConnections = 0;
        let numRequests = 0;

        mockH2Server4.on("stream", (request: Http2Stream) => {
          numRequests += 1;
          (request.session as any)!.destroy();
        });
        mockH2Server4.on("connection", () => {
          establishedConnections += 1;
        });
        const req = new HttpRequest({ ...getMockReqOptions(), port });
        expect(establishedConnections).toBe(0);
        expect(numRequests).toBe(0);
        await rejects(
          nodeH2Handler.handle(req, {}),
          UNEXPECTEDLY_CLOSED_REGEX,
          "should be rejected promptly due to destroyed connection"
        );
        expect(establishedConnections).toBe(1);
        expect(numRequests).toBe(1);
        await rejects(
          nodeH2Handler.handle(req, {}),
          UNEXPECTEDLY_CLOSED_REGEX,
          "should be rejected promptly due to destroyed connection"
        );
        expect(establishedConnections).toBe(2);
        expect(numRequests).toBe(2);
        await rejects(
          nodeH2Handler.handle(req, {}),
          UNEXPECTEDLY_CLOSED_REGEX,
          "should be rejected promptly due to destroyed connection"
        );
        expect(establishedConnections).toBe(3);
        expect(numRequests).toBe(3);
        mockH2Server4.close();

        // Not keeping node alive
        expect(createdSessions).toHaveLength(3);
        expectSessionCreatedAndDestroyed(createdSessions[0]);
        expectSessionCreatedAndDestroyed(createdSessions[1]);
        expectSessionCreatedAndDestroyed(createdSessions[2]);
      });

      it("handles servers calling connections close", async () => {
        const port = port3;
        const mockH2Server4 = mockH2Servers[port];

        mockH2Server4.on("stream", (request: Http2Stream) => {
          // Server gracefully closes the session (sends GOAWAY with NO_ERROR)
          // and resets the stream so it completes.
          request.close();
          (request.session as any)!.close();
        });

        const req = new HttpRequest({ ...getMockReqOptions(), port });

        // Each request should be rejected because the server closes
        // without sending a response. Subsequent requests may fail
        // client-side (frameError on closed session) before reaching
        // the server.
        await rejects(nodeH2Handler.handle(req, {}), UNEXPECTEDLY_CLOSED_REGEX);
        await rejects(nodeH2Handler.handle(req, {}), UNEXPECTEDLY_CLOSED_REGEX);
        await rejects(nodeH2Handler.handle(req, {}), UNEXPECTEDLY_CLOSED_REGEX);

        mockH2Server4.close();
      });
    });

    describe("destroy", () => {
      it("destroys session and clears connectionPools", async () => {
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

        const sessionRef = getFirstSession(nodeH2Handler, authority);
        const session: ClientHttp2Session = sessionRef.deref();

        expect(getConnectionPools(nodeH2Handler).size).toBe(1);
        expect(session.destroyed).toBe(false);
        nodeH2Handler.destroy();
        expect(getConnectionPools(nodeH2Handler).size).toBe(0);
        expect(session.destroyed).toBe(true);
      });
    });

    describe("abortSignal", () => {
      it("will not create session if request already aborted", async () => {
        expect(getConnectionPools(nodeH2Handler).size).toBe(0);
        await expect(
          nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {
            abortSignal: {
              aborted: true,
              onabort: null,
            },
          })
        ).rejects.toHaveProperty("name", "AbortError");
        expect(getConnectionPools(nodeH2Handler).size).toBe(0);
      });

      it("will not create request on session if request already aborted", async () => {
        // Create a session by sending a request.
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

        const session: ClientHttp2Session = getFirstSession(nodeH2Handler, authority).deref();
        const requestSpy = vi.spyOn(session, "request");

        await expect(
          nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {
            abortSignal: {
              aborted: true,
              onabort: null,
            },
          })
        ).rejects.toHaveProperty("name", "AbortError");
        expect(requestSpy.mock.calls.length).toBe(0);
      });

      it.each([
        { AbortController, label: "native" },
        { AbortController: AbortControllerPolyfill, label: "polyfill" },
      ])("will close request on session when aborted ($label)", async ({ AbortController }) => {
        const abortController = new AbortController();
        mockH2Server.removeAllListeners("request");
        mockH2Server.on("request", () => {
          abortController.abort();
          return createResponseFunction(mockResponse);
        });

        await expect(
          nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {
            abortSignal: abortController.signal,
          })
        ).rejects.toHaveProperty("name", "AbortError");
      });
    });
  });

  describe("requestTimeout", () => {
    const requestTimeout = 200;

    describe("does not throw error when request not timed out", () => {
      it.each([
        ["static object", { requestTimeout }],
        ["object provider", async () => ({ requestTimeout })],
      ])("disableConcurrentStreams: false (default) in constructor parameter of %s", async (_, options) => {
        mockH2Server.removeAllListeners("request");
        mockH2Server.on("request", createResponseFunctionWithDelay(mockResponse, requestTimeout - 100));

        nodeH2Handler = new NodeHttp2Handler(options);
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});
      });

      it.each([
        ["static object", { requestTimeout, disableConcurrentStreams: true }],
        ["object provider", async () => ({ requestTimeout, disableConcurrentStreams: true })],
      ])("disableConcurrentStreams: true in constructor parameter of %s", async (_, options) => {
        mockH2Server.removeAllListeners("request");
        mockH2Server.on("request", createResponseFunctionWithDelay(mockResponse, requestTimeout - 100));

        nodeH2Handler = new NodeHttp2Handler(options);
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});
      });
    });

    describe("throws timeoutError on requestTimeout", () => {
      it.each([
        ["static object", { requestTimeout }],
        ["object provider", async () => ({ requestTimeout })],
      ])("disableConcurrentStreams: false (default) in constructor parameter of %s", async (_, options) => {
        mockH2Server.removeAllListeners("request");
        mockH2Server.on("request", createResponseFunctionWithDelay(mockResponse, requestTimeout + 100));

        nodeH2Handler = new NodeHttp2Handler(options);
        await rejects(nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {}), {
          name: "TimeoutError",
          message: `Stream timed out because of no activity for ${requestTimeout} ms`,
        });
      });

      it.each([
        ["object provider", async () => ({ requestTimeout })],
        ["static object", { requestTimeout }],
      ])("disableConcurrentStreams: true in constructor parameter of %s", async () => {
        mockH2Server.removeAllListeners("request");
        mockH2Server.on("request", createResponseFunctionWithDelay(mockResponse, requestTimeout + 100));

        nodeH2Handler = new NodeHttp2Handler({ requestTimeout, disableConcurrentStreams: true });
        await rejects(nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {}), {
          name: "TimeoutError",
          message: `Stream timed out because of no activity for ${requestTimeout} ms`,
        });
      });
    });
  });

  describe("sessionTimeout", () => {
    const sessionTimeout = 200;

    describe("destroys sessions on sessionTimeout", () => {
      it.each([
        ["object provider", async () => ({ sessionTimeout })],
        ["static object", { sessionTimeout }],
      ])("disableConcurrentStreams: false (default) in constructor parameter of %s", async (_, options) => {
        nodeH2Handler = new NodeHttp2Handler(options);
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), { requestTimeout: sessionTimeout });

        const session: ClientHttp2Session = getFirstSession(nodeH2Handler, authority).deref();
        expect(session.destroyed).toBe(false);
        expect(getSessions(nodeH2Handler, authority).length).toStrictEqual(1);
        await promisify(setTimeout)(sessionTimeout + 100);
        expect(session.destroyed).toBe(true);
        expect(getSessions(nodeH2Handler, authority).length).toStrictEqual(0);
      });

      it.each([
        ["object provider", async () => ({ sessionTimeout, disableConcurrentStreams: true })],
        ["static object", { sessionTimeout, disableConcurrentStreams: true }],
      ])("disableConcurrentStreams: true in constructor parameter of %s", async (_, options) => {
        let session: any;

        nodeH2Handler = new NodeHttp2Handler(options);

        const connectReal = http2.connect;
        vi.spyOn(http2, "connect").mockImplementation((...args: any[]) => {
          session = connectReal(args[0], args[1]);
          return session;
        });

        mockH2Server.removeAllListeners("request");
        mockH2Server.on("request", (request: any, response: any) => {
          createResponseFunction(mockResponse)(request, response);
        });
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

        expect(session?.destroyed).toBe(false);
        await promisify(setTimeout)(sessionTimeout + 100);
        expect(session?.destroyed).toBe(true);
      });
    });
  });

  describe("maxConcurrency", () => {
    it.each([
      ["static object", {}],
      ["static object", { maxConcurrentStreams: 0 }],
      ["static object", { maxConcurrentStreams: 1 }],
      ["static object", { maxConcurrentStreams: 2 }],
      ["static object", { maxConcurrentStreams: 3 }],
    ])("verify session settings' maxConcurrentStreams", async (_, options: NodeHttp2HandlerOptions) => {
      nodeH2Handler = new NodeHttp2Handler(options);

      await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

      const session = getFirstSession(nodeH2Handler, authority).deref();

      if (options.maxConcurrentStreams) {
        expect(session.localSettings.maxConcurrentStreams).toBe(options.maxConcurrentStreams);
      } else {
        expect(session.localSettings.maxConcurrentStreams).toBe(4294967295);
      }
    });

    it("verify error thrown when maxConcurrentStreams is negative", async () => {
      let error: Error | undefined = undefined;
      try {
        nodeH2Handler = new NodeHttp2Handler({ maxConcurrentStreams: -1 });

        const options = getMockReqOptions();
        await nodeH2Handler.handle(new HttpRequest(options), {});
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error!.message).toEqual("maxConcurrentStreams must be greater than zero.");
    });
  });

  it("will throw reasonable error when connection aborted abnormally", async () => {
    nodeH2Handler = new NodeHttp2Handler();
    // Create a session by sending a request.
    await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});
    const session: ClientHttp2Session = getFirstSession(nodeH2Handler, authority).deref();
    const fakeStream = new Duplex() as ClientHttp2Stream;
    const fakeRstCode = 1;
    // @ts-ignore: fake result code
    (fakeStream as Mutable<typeof fakeStream>).rstCode = fakeRstCode;
    vi.spyOn(session, "request").mockImplementation(() => fakeStream);
    getConnectionPools(nodeH2Handler).set(authority, new NodeHttp2ConnectionPool([session]));
    // Delay response so that onabort is called earlier
    timing.setTimeout(() => {
      fakeStream.emit("aborted");
    }, 0);

    await expect(nodeH2Handler.handle(new HttpRequest({ ...getMockReqOptions() }), {})).rejects.toHaveProperty(
      "message",
      `HTTP/2 stream is abnormally aborted in mid-communication with result code ${fakeRstCode}.`
    );
  });

  it("will throw reasonable error when frameError is thrown", async () => {
    nodeH2Handler = new NodeHttp2Handler();
    // Create a session by sending a request.
    await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});
    const session: ClientHttp2Session = getFirstSession(nodeH2Handler, authority).deref();
    const fakeStream = new Duplex() as ClientHttp2Stream;
    vi.spyOn(session, "request").mockImplementation(() => fakeStream);
    getConnectionPools(nodeH2Handler).set(authority, new NodeHttp2ConnectionPool([session]));
    // Delay response so that onabort is called earlier
    timing.setTimeout(() => {
      fakeStream.emit("frameError", "TYPE", "CODE", "ID");
    }, 0);

    await expect(nodeH2Handler.handle(new HttpRequest({ ...getMockReqOptions() }), {})).rejects.toHaveProperty(
      "message",
      `Frame type id TYPE in stream id ID has failed with code CODE.`
    );
  });

  describe("per-request requestTimeout", () => {
    it("should use per-request timeout over handler config timeout", async () => {
      const nodeH2Handler = new NodeHttp2Handler({ requestTimeout: 5000 });

      const mockH2Server = mockH2Servers[port1];
      mockH2Server.removeAllListeners("request");
      mockH2Server.on("request", () => {
        // don't respond - let it timeout
      });

      const mockRequest = new HttpRequest(getMockReqOptions());

      const start = Date.now();
      await expect(nodeH2Handler.handle(mockRequest, { requestTimeout: 100 })).rejects.toHaveProperty(
        "name",
        "TimeoutError"
      );

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
    });

    it("should fall back to handler config timeout when per-request timeout not provided", async () => {
      const nodeH2Handler = new NodeHttp2Handler({ requestTimeout: 100 });

      const mockH2Server = mockH2Servers[port1];
      mockH2Server.removeAllListeners("request");
      mockH2Server.on("request", () => {});

      const mockRequest = new HttpRequest(getMockReqOptions());

      const start = Date.now();
      await expect(nodeH2Handler.handle(mockRequest, {})).rejects.toHaveProperty("name", "TimeoutError");

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe.each([
    ["object provider", async () => ({ disableConcurrentStreams: true })],
    ["static object", { disableConcurrentStreams: true }],
  ])("disableConcurrentStreams in constructor parameter of %s", (_, options) => {
    beforeEach(() => {
      nodeH2Handler = new NodeHttp2Handler(options);
    });

    describe("number calls to http2.connect", () => {
      it("is zero on initialization", () => {
        const connectSpy = vi.spyOn(http2, "connect");
        expect(connectSpy).not.toHaveBeenCalled();
      });

      it("is one when request is made", async () => {
        const connectSpy = vi.spyOn(http2, "connect");

        // Make single request.
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});
        expect(connectSpy).toHaveBeenCalledTimes(1);
        expect(connectSpy).toHaveBeenCalledWith(authority);
      });

      it("is many if multiple requests are made on same URL", async () => {
        const connectSpy = vi.spyOn(http2, "connect");

        // Make two requests.
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

        expect(connectSpy).toHaveBeenCalledTimes(2);
        expect(connectSpy).toHaveBeenNthCalledWith(1, authority);
        expect(connectSpy).toHaveBeenNthCalledWith(2, authority);
      });

      it("is many if requests are made on different URLs", async () => {
        const connectSpy = vi.spyOn(http2, "connect");

        // Make first request on default URL.
        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

        const mockH2Server2 = mockH2Servers[port2];
        mockH2Server2.on("request", createResponseFunction(mockResponse));

        // Make second request on URL with port2.
        await nodeH2Handler.handle(new HttpRequest({ ...getMockReqOptions(), port: port2 }), {});

        const authorityPrefix = `${protocol}//${hostname}`;
        expect(connectSpy).toHaveBeenCalledTimes(2);
        expect(connectSpy).toHaveBeenNthCalledWith(1, `${authorityPrefix}:${port1}/`);
        expect(connectSpy).toHaveBeenNthCalledWith(2, `${authorityPrefix}:${port2}/`);
        mockH2Server2.close();
      });
    });

    describe("destroy", () => {
      it("destroys session and empties connectionPools", async () => {
        const connectReal = http2.connect;
        let createdSession: ClientHttp2Session | undefined;
        vi.spyOn(http2, "connect").mockImplementation((...args: any[]) => {
          const session = connectReal(args[0], args[1]);
          createdSession = session;
          return session;
        });

        await nodeH2Handler.handle(new HttpRequest(getMockReqOptions()), {});

        // Isolated sessions (disableConcurrentStreams) are not in the pool.
        expect(createdSession).toBeDefined();
        expect(createdSession!.destroyed).toBe(false);

        nodeH2Handler.destroy();
        // Pool should be empty (isolated sessions were never added).
        expect(getConnectionPools(nodeH2Handler).size).toBe(0);
      });
    });
  });

  describe("server", () => {
    let server: Http2Server;

    beforeEach(async () => {
      const port = await getPort({ port: portNumbers(45_321, 50_000) });
      server = createMockHttp2Server().listen(port);
    });

    afterEach(() => {
      server.close();
    });

    it("sends the request to the correct url", async () => {
      server.on("request", (request, response) => {
        expect(request.url).toBe("http://foo:bar@localhost/foo/bar?foo=bar#foo");
        response.statusCode = 200;
      });
      const handler = new NodeHttp2Handler({});
      await handler.handle({
        ...getMockReqOptions(),
        username: "foo",
        password: "bar",
        path: "/foo/bar",
        query: { foo: "bar" },
        fragment: "foo",
      } as any);
      handler.destroy();
    });

    it("put HttpClientConfig", async () => {
      server.on("request", (request, response) => {
        expect(request.url).toBe("http://foo:bar@localhost/");
        response.statusCode = 200;
      });
      const handler = new NodeHttp2Handler({});

      const requestTimeout = 200;

      handler.updateHttpClientConfig("requestTimeout", requestTimeout);

      await handler.handle({
        ...getMockReqOptions(),
        username: "foo",
        password: "bar",
        path: "/",
      } as any);
      handler.destroy();

      expect(handler.httpHandlerConfigs().requestTimeout).toEqual(requestTimeout);
    });

    it("update existing HttpClientConfig", async () => {
      server.on("request", (request, response) => {
        expect(request.url).toBe("http://foo:bar@localhost/");
        response.statusCode = 200;
      });
      const handler = new NodeHttp2Handler({ requestTimeout: 200 });

      const requestTimeout = 300;

      handler.updateHttpClientConfig("requestTimeout", requestTimeout);

      await handler.handle({
        ...getMockReqOptions(),
        username: "foo",
        password: "bar",
        path: "/",
      } as any);
      handler.destroy();

      expect(handler.httpHandlerConfigs().requestTimeout).toEqual(requestTimeout);
    });
  });

  it("httpHandlerConfigs returns empty object if handle is not called", async () => {
    const nodeHttpHandler = new NodeHttp2Handler();
    expect(nodeHttpHandler.httpHandlerConfigs()).toEqual({});
  });

  describe("ref-counting for http2 sessions", () => {
    let createdSessions: ClientHttp2Session[];
    const connectReal = http2.connect;

    beforeEach(() => {
      createdSessions = [];
      vi.spyOn(http2, "connect").mockImplementation((...args: any[]) => {
        const session = connectReal(args[0], args[1]);
        vi.spyOn(session, "ref");
        vi.spyOn(session, "unref");
        createdSessions.push(session);
        return session;
      });
    });

    it("acquires ref on request start and releases on stream close", async () => {
      const handler = new NodeHttp2Handler();
      const { response } = await handler.handle(new HttpRequest(getMockReqOptions()), {});
      const session = createdSessions[0];

      // constructor unref + get() ref = session is ref'd (keeping node alive)
      expect(session.unref).toHaveBeenCalledTimes(1);
      expect(session.ref).toHaveBeenCalledTimes(1);

      // close the response stream to trigger req "close" -> ref.free()
      const body = response.body as ClientHttp2Stream;
      const closePromise = new Promise((resolve) => body.once("close", resolve));
      body.destroy();
      await closePromise;

      // free() reached zero -> unref called again
      expect(session.unref).toHaveBeenCalledTimes(2);
      handler.destroy();
    });

    it("maintains positive refcount across concurrent requests on same session", async () => {
      const handler = new NodeHttp2Handler();
      const { response: r1 } = await handler.handle(new HttpRequest(getMockReqOptions()), {});
      const { response: r2 } = await handler.handle(new HttpRequest(getMockReqOptions()), {});
      const session = createdSessions[0];

      // 1 session, 2 get() calls
      expect(createdSessions).toHaveLength(1);
      expect(session.ref).toHaveBeenCalledTimes(2);
      // only constructor unref so far (refcount is 2, not zero)
      expect(session.unref).toHaveBeenCalledTimes(1);

      // close first stream — refcount drops to 1, no unref
      const body1 = r1.body as ClientHttp2Stream;
      const close1 = new Promise((resolve) => body1.once("close", resolve));
      body1.destroy();
      await close1;
      expect(session.unref).toHaveBeenCalledTimes(1); // still 1

      // close second stream — refcount drops to 0, unref called
      const body2 = r2.body as ClientHttp2Stream;
      const close2 = new Promise((resolve) => body2.once("close", resolve));
      body2.destroy();
      await close2;
      expect(session.unref).toHaveBeenCalledTimes(2);
      handler.destroy();
    });

    it("opens additional sessions when maxConcurrentStreams is reached", async () => {
      const maxConcurrentStreams = 3;
      const totalRequests = 10;
      const handler = new NodeHttp2Handler({ maxConcurrentStreams });

      // Fire all requests concurrently.
      const responses = await Promise.all(
        Array.from({ length: totalRequests }, () => handler.handle(new HttpRequest(getMockReqOptions()), {}))
      );

      // 10 requests at concurrency 3 = ceil(10/3) = 4 sessions.
      expect(createdSessions).toHaveLength(4);

      const pools = getConnectionManager(handler).debug();
      const sessions = pools[authority].sessions;
      const inFlightCounts = sessions.map((s: any) => s.active).sort();
      expect(inFlightCounts).toEqual([1, 3, 3, 3]);

      // Close all streams.
      for (const { response } of responses) {
        const body = response.body as ClientHttp2Stream;
        const close = new Promise((resolve) => body.once("close", resolve));
        body.destroy();
        await close;
      }

      const poolsAfter = getConnectionManager(handler).debug();
      for (const s of poolsAfter[authority].sessions) {
        expect(s.active).toBe(0);
      }

      handler.destroy();
    });
  });
});
