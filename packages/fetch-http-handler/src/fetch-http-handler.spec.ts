import { AbortController } from "@smithy/abort-controller";
import { HttpRequest } from "@smithy/protocol-http";
import { afterAll, afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { FetchHttpHandler, keepAliveSupport } from "./fetch-http-handler";
import { requestTimeout } from "./request-timeout";

const mockRequest = vi.fn();
let timeoutSpy: any;

(global as any).Request = mockRequest;
(global as any).Headers = vi.fn();
const globalFetch = global.fetch;

(typeof Blob === "function" ? describe : describe.skip)(FetchHttpHandler.name, () => {
  beforeEach(() => {
    (global as any).AbortController = void 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    if (timeoutSpy) {
      timeoutSpy.mockRestore();
    }
  });

  afterAll(() => {
    global.fetch = globalFetch;
  });

  it("makes requests using fetch", async () => {
    const mockResponse = {
      headers: {
        entries: vi.fn().mockReturnValue([
          ["foo", "bar"],
          ["bizz", "bazz"],
        ]),
      },
      blob: vi.fn().mockResolvedValue(new Blob(["FOO"])),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    (global as any).fetch = mockFetch;
    const fetchHttpHandler = new FetchHttpHandler();

    const response = await fetchHttpHandler.handle({} as any, {});

    expect(mockFetch.mock.calls.length).toBe(1);
    expect(await blobToText(response.response.body)).toBe("FOO");
  });

  it("put HttpClientConfig", async () => {
    const mockResponse = {
      headers: {
        entries: vi.fn().mockReturnValue([
          ["foo", "bar"],
          ["bizz", "bazz"],
        ]),
      },
      blob: vi.fn().mockResolvedValue(new Blob(["FOO"])),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    (global as any).fetch = mockFetch;
    const fetchHttpHandler = new FetchHttpHandler();
    fetchHttpHandler.updateHttpClientConfig("requestTimeout", 200);

    await fetchHttpHandler.handle({} as any, {});

    expect(fetchHttpHandler.httpHandlerConfigs().requestTimeout).toBe(200);
  });

  it("update HttpClientConfig", async () => {
    const mockResponse = {
      headers: {
        entries: vi.fn().mockReturnValue([
          ["foo", "bar"],
          ["bizz", "bazz"],
        ]),
      },
      blob: vi.fn().mockResolvedValue(new Blob(["FOO"])),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    (global as any).fetch = mockFetch;
    const fetchHttpHandler = new FetchHttpHandler({ requestTimeout: 200 });
    fetchHttpHandler.updateHttpClientConfig("requestTimeout", 300);

    await fetchHttpHandler.handle({} as any, {});

    expect(fetchHttpHandler.httpHandlerConfigs().requestTimeout).toBe(300);
  });

  it("httpHandlerConfigs returns empty object if handle is not called", async () => {
    const fetchHttpHandler = new FetchHttpHandler();
    fetchHttpHandler.updateHttpClientConfig("requestTimeout", 300);
    expect(fetchHttpHandler.httpHandlerConfigs()).toEqual({});
  });

  it("defaults to response.blob for response.body = null", async () => {
    const mockResponse = {
      body: null,
      headers: {
        entries: vi.fn().mockReturnValue([
          ["foo", "bar"],
          ["bizz", "bazz"],
        ]),
      },
      blob: vi.fn().mockResolvedValue(new Blob(["FOO"])),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    (global as any).fetch = mockFetch;
    const fetchHttpHandler = new FetchHttpHandler();

    const response = await fetchHttpHandler.handle({} as any, {});

    expect(mockFetch.mock.calls.length).toBe(1);
    expect(await blobToText(response.response.body)).toBe("FOO");
  });

  it("properly constructs url", async () => {
    const mockResponse = {
      headers: {
        entries: vi.fn().mockReturnValue([
          ["foo", "bar"],
          ["bizz", "bazz"],
        ]),
      },
      blob: vi.fn().mockResolvedValue(new Blob()),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    (global as any).fetch = mockFetch;

    const httpRequest = new HttpRequest({
      headers: {},
      hostname: "foo.amazonaws.com",
      method: "GET",
      path: "/test",
      query: { bar: "baz" },
      username: "username",
      password: "password",
      fragment: "fragment",
      protocol: "https:",
      port: 443,
    });
    const fetchHttpHandler = new FetchHttpHandler();

    await fetchHttpHandler.handle(httpRequest, {});

    expect(mockFetch.mock.calls.length).toBe(1);
    const requestCall = mockRequest.mock.calls[0];
    expect(requestCall[0]).toBe("https://username:password@foo.amazonaws.com:443/test?bar=baz#fragment");
  });

  it("will omit body if method is GET", async () => {
    const mockResponse = {
      headers: { entries: vi.fn().mockReturnValue([]) },
      blob: vi.fn().mockResolvedValue(new Blob()),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    (global as any).fetch = mockFetch;

    const httpRequest = new HttpRequest({
      headers: {},
      hostname: "foo.amazonaws.com",
      method: "GET",
      path: "/",
      body: "will be omitted",
    });
    const fetchHttpHandler = new FetchHttpHandler();

    await fetchHttpHandler.handle(httpRequest, {});

    expect(mockFetch.mock.calls.length).toBe(1);
    const requestCall = mockRequest.mock.calls[0];
    expect(requestCall[1].body).toBeUndefined();
  });

  it("will omit body if method is HEAD", async () => {
    const mockResponse = {
      headers: { entries: vi.fn().mockReturnValue([]) },
      blob: vi.fn().mockResolvedValue(new Blob()),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    (global as any).fetch = mockFetch;

    const httpRequest = new HttpRequest({
      headers: {},
      hostname: "foo.amazonaws.com",
      method: "HEAD",
      path: "/",
      body: "will be omitted",
    });
    const fetchHttpHandler = new FetchHttpHandler();

    await fetchHttpHandler.handle(httpRequest, {});

    expect(mockFetch.mock.calls.length).toBe(1);
    const requestCall = mockRequest.mock.calls[0];
    expect(requestCall[1].body).toBeUndefined();
  });

  it("will not make request if already aborted", async () => {
    const mockResponse = {
      headers: {
        entries: vi.fn().mockReturnValue([
          ["foo", "bar"],
          ["bizz", "bazz"],
        ]),
      },
      blob: vi.fn().mockResolvedValue(new Blob()),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);

    (global as any).fetch = mockFetch;
    const fetchHttpHandler = new FetchHttpHandler();

    await expect(
      fetchHttpHandler.handle({} as any, {
        abortSignal: {
          aborted: true,
          onabort: null,
        },
      })
    ).rejects.toHaveProperty("name", "AbortError");

    expect(mockFetch.mock.calls.length).toBe(0);
  });

  it("will pass abortSignal to fetch if supported", async () => {
    const mockResponse = {
      headers: {
        entries: vi.fn().mockReturnValue([
          ["foo", "bar"],
          ["bizz", "bazz"],
        ]),
      },
      blob: vi.fn().mockResolvedValue(new Blob()),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = mockFetch;
    (global as any).AbortController = vi.fn();
    const fetchHttpHandler = new FetchHttpHandler();

    await fetchHttpHandler.handle({} as any, {
      abortSignal: {
        aborted: false,
        onabort: null,
      },
    });

    expect(mockRequest.mock.calls[0][1]).toHaveProperty("signal");
    expect(mockFetch.mock.calls.length).toBe(1);
  });

  it("will pass timeout to request timeout", async () => {
    const mockResponse = {
      headers: {
        entries: vi.fn().mockReturnValue([
          ["foo", "bar"],
          ["bizz", "bazz"],
        ]),
      },
      blob: vi.fn().mockResolvedValue(new Blob()),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = mockFetch;

    timeoutSpy = vi.spyOn({ requestTimeout }, "requestTimeout");
    const fetchHttpHandler = new FetchHttpHandler({
      requestTimeout: 500,
    });

    await fetchHttpHandler.handle({} as any, {});

    expect(mockFetch.mock.calls.length).toBe(1);
  });

  it("will pass timeout from a provider to request timeout", async () => {
    const mockResponse = {
      headers: {
        entries: () => [],
      },
      blob: async () => new Blob(),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = mockFetch;

    timeoutSpy = vi.spyOn({ requestTimeout }, "requestTimeout");
    const fetchHttpHandler = new FetchHttpHandler(async () => ({
      requestTimeout: 500,
    }));

    await fetchHttpHandler.handle({} as any, {});

    expect(mockFetch.mock.calls.length).toBe(1);
  });

  it("will throw timeout error it timeout finishes before request", async () => {
    const mockFetch = vi.fn(() => {
      return new Promise(() => {});
    });
    (global as any).fetch = mockFetch;
    const fetchHttpHandler = new FetchHttpHandler({
      requestTimeout: 5,
    });

    await expect(fetchHttpHandler.handle({} as any, {})).rejects.toHaveProperty("name", "TimeoutError");
    expect(mockFetch.mock.calls.length).toBe(1);
  });

  it("can be aborted before fetch completes", async () => {
    const abortController = new AbortController();

    const mockFetch = vi.fn(() => {
      return new Promise(() => {});
    });
    (global as any).fetch = mockFetch;

    setTimeout(() => {
      abortController.abort();
    }, 100);
    const fetchHttpHandler = new FetchHttpHandler();

    await expect(
      fetchHttpHandler.handle({} as any, {
        abortSignal: abortController.signal,
      })
    ).rejects.toHaveProperty("name", "AbortError");

    // ensure that fetch's built-in mechanism isn't being used
    expect(mockRequest.mock.calls[0][1]).not.toHaveProperty("signal");
  });

  it("creates correct HTTPResponse object", async () => {
    const mockResponse = {
      headers: {
        entries: vi.fn().mockReturnValue([["foo", "bar"]]),
      },
      blob: vi.fn().mockResolvedValue(new Blob(["FOO"])),
      status: 200,
      statusText: "foo",
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = mockFetch;

    const fetchHttpHandler = new FetchHttpHandler();
    const { response } = await fetchHttpHandler.handle({} as any, {});

    expect(mockFetch.mock.calls.length).toBe(1);
    expect(response.headers).toStrictEqual({ foo: "bar" });
    expect(response.reason).toBe("foo");
    expect(response.statusCode).toBe(200);
    expect(await blobToText(response.body)).toBe("FOO");
  });

  it.each(["include", "omit", "same-origin"])(
    "will pass credentials mode '%s' from a provider to a request",
    async (credentialsMode) => {
      const mockResponse = {
        headers: { entries: vi.fn().mockReturnValue([]) },
        blob: vi.fn().mockResolvedValue(new Blob()),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);

      (global as any).fetch = mockFetch;

      const httpRequest = new HttpRequest({
        headers: {},
        hostname: "foo.amazonaws.com",
        method: "GET",
        path: "/",
        body: "will be omitted",
      });
      const fetchHttpHandler = new FetchHttpHandler();
      fetchHttpHandler.updateHttpClientConfig("credentials", credentialsMode as RequestCredentials);

      await fetchHttpHandler.handle(httpRequest, {});

      expect(mockFetch.mock.calls.length).toBe(1);
      const requestCall = mockRequest.mock.calls[0];
      expect(requestCall[1].credentials).toBe(credentialsMode);
    }
  );

  describe("#destroy", () => {
    it("should be callable and return nothing", () => {
      const httpHandler = new FetchHttpHandler();
      expect(httpHandler.destroy()).toBeUndefined();
    });
  });

  describe("keepalive", () => {
    it("will pass keepalive as false by default to request if supported", async () => {
      const mockResponse = {
        headers: {
          entries: vi.fn().mockReturnValue([
            ["foo", "bar"],
            ["bizz", "bazz"],
          ]),
        },
        blob: vi.fn().mockResolvedValue(new Blob()),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      (global as any).fetch = mockFetch;

      const fetchHttpHandler = new FetchHttpHandler();

      keepAliveSupport.supported = true;
      await fetchHttpHandler.handle({} as any, {});

      expect(mockRequest.mock.calls[0][1].keepalive).toBe(false);
    });

    it("will pass keepalive to request if supported", async () => {
      const mockResponse = {
        headers: {
          entries: vi.fn().mockReturnValue([
            ["foo", "bar"],
            ["bizz", "bazz"],
          ]),
        },
        blob: vi.fn().mockResolvedValue(new Blob()),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      (global as any).fetch = mockFetch;

      const fetchHttpHandler = new FetchHttpHandler({ keepAlive: true });

      keepAliveSupport.supported = true;
      await fetchHttpHandler.handle({} as any, {});

      expect(mockRequest.mock.calls[0][1].keepalive).toBe(true);
    });

    it("will not have keepalive property in request if not supported", async () => {
      const mockResponse = {
        headers: {
          entries: vi.fn().mockReturnValue([
            ["foo", "bar"],
            ["bizz", "bazz"],
          ]),
        },
        blob: vi.fn().mockResolvedValue(new Blob()),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      (global as any).fetch = mockFetch;
      mockRequest.mockImplementation(() => null);

      const fetchHttpHandler = new FetchHttpHandler({ keepAlive: false });

      keepAliveSupport.supported = false;
      await fetchHttpHandler.handle({} as any, {});
      expect(mockRequest.mock.calls[0][1]).not.toHaveProperty("keepalive");
    });
  });

  describe("custom requestInit", () => {
    it("should allow setting cache requestInit", async () => {
      const mockResponse = {
        headers: {
          entries() {
            return [];
          },
        },
        blob: vi.fn().mockResolvedValue(new Blob()),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      (global as any).fetch = mockFetch;

      const fetchHttpHandler = new FetchHttpHandler({
        cache: "no-store",
      });

      await fetchHttpHandler.handle({} as any, {});

      expect(mockRequest.mock.calls[0][1].cache).toBe("no-store");
    });

    it("should allow setting custom requestInit", async () => {
      const mockResponse = {
        headers: {
          entries() {
            return [];
          },
        },
        blob: vi.fn().mockResolvedValue(new Blob()),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      (global as any).fetch = mockFetch;

      const fetchHttpHandler = new FetchHttpHandler({
        requestInit(req) {
          return {
            referrer: "me",
            cache: "reload",
            headers: {
              a: "a",
              b: req.headers.b,
            },
          };
        },
      });

      await fetchHttpHandler.handle(
        {
          headers: {
            b: "b",
          },
        } as any,
        {}
      );

      expect(mockRequest.mock.calls[0][1]).toEqual({
        referrer: "me",
        cache: "reload",
        headers: {
          a: "a",
          b: "b",
        },
      });
    });
  });

  // The Blob implementation does not implement Blob.text, so we deal with it here.
  async function blobToText(blob: Blob): Promise<string> {
    return blob.text();
  }
});
