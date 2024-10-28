import { HttpRequest } from "@smithy/protocol-http";
import { QueryParameterBag } from "@smithy/types";
import { afterEach, beforeAll, describe, expect, test as it, vi } from "vitest";

import { createRequest } from "./create-request";
import { FetchHttpHandler, keepAliveSupport } from "./fetch-http-handler";

vi.mock("./create-request", async () => {
  const actual: any = await vi.importActual("./create-request");
  return {
    createRequest: vi.fn().mockImplementation(actual.createRequest),
  };
});

(typeof Blob === "function" ? describe : describe.skip)(FetchHttpHandler.name, () => {
  interface MockHttpRequestOptions {
    method?: string;
    body?: any;
    query?: QueryParameterBag;
    fragment?: string;
    username?: string;
    password?: string;
  }

  const getMockHttpRequest = (options: MockHttpRequestOptions): HttpRequest =>
    new HttpRequest({ hostname: "example.com", ...options });

  describe("fetch", () => {
    beforeAll(() => {
      keepAliveSupport.supported = true;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("sends basic fetch request", async () => {
      const fetchHttpHandler = new FetchHttpHandler();

      const mockHttpRequest = getMockHttpRequest({});
      await fetchHttpHandler.handle(mockHttpRequest);

      const expectedUrl = `${mockHttpRequest.protocol}//${mockHttpRequest.hostname}/`;
      const requestArgs = vi.mocked(createRequest).mock.calls[0];

      expect(requestArgs[0]).toEqual(expectedUrl);
      expect(requestArgs[1]!.method).toEqual(mockHttpRequest.method);
      expect(requestArgs[1]!.keepalive).toEqual(false);
    });

    for (const method of ["GET", "HEAD"]) {
      it(`sets body to undefined when method: '${method}'`, async () => {
        const fetchHttpHandler = new FetchHttpHandler();

        const mockHttpRequest = getMockHttpRequest({ method, body: "test" });
        await fetchHttpHandler.handle(mockHttpRequest);

        const requestArgs = vi.mocked(createRequest).mock.calls[0];
        expect(requestArgs[1]!.method).toEqual(mockHttpRequest.method);
        expect(requestArgs[1]!.body).toEqual(undefined);
      });
    }

    it(`sets keepalive to true if explicitly requested`, async () => {
      const fetchHttpHandler = new FetchHttpHandler({ keepAlive: true });

      const mockHttpRequest = getMockHttpRequest({});
      await fetchHttpHandler.handle(mockHttpRequest);

      const requestArgs = vi.mocked(createRequest).mock.calls[0];
      expect(requestArgs[1]!.keepalive).toEqual(true);
    });

    it(`builds querystring if provided`, async () => {
      const fetchHttpHandler = new FetchHttpHandler();

      const query = { foo: "bar" };
      const fragment = "test";
      const mockHttpRequest = getMockHttpRequest({ query, fragment });
      await fetchHttpHandler.handle(mockHttpRequest);

      const expectedUrl = `${mockHttpRequest.protocol}//${mockHttpRequest.hostname}/?${Object.entries(query)
        .map(([key, val]) => `${key}=${val}`)
        .join("&")}#${fragment}`;
      const requestArgs = vi.mocked(createRequest).mock.calls[0];
      expect(requestArgs[0]).toEqual(expectedUrl);
    });

    it(`sets auth if username/password are provided`, async () => {
      const fetchHttpHandler = new FetchHttpHandler();

      const username = "foo";
      const password = "bar";
      const mockHttpRequest = getMockHttpRequest({ username, password });
      await fetchHttpHandler.handle(mockHttpRequest).catch((error) => {
        expect(String(error)).toContain(
          "TypeError: Request cannot be constructed from a URL that includes credentials"
        );
      });

      const mockAuth = `${mockHttpRequest.username}:${mockHttpRequest.password}`;
      const expectedUrl = `${mockHttpRequest.protocol}//${mockAuth}@${mockHttpRequest.hostname}/`;
      const requestArgs = vi.mocked(createRequest).mock.calls[0];
      expect(requestArgs[0]).toEqual(expectedUrl);
    });
  });
});
