import { HttpRequest } from "@smithy/protocol-http";
import { QueryParameterBag } from "@smithy/types";

import { FetchHttpHandler } from "./fetch-http-handler";

describe(FetchHttpHandler.name, () => {
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
    it("sends basic fetch request", async () => {
      const fetchHttpHandler = new FetchHttpHandler();
      const winReqSpy = spyOn(window, "Request");

      const mockHttpRequest = getMockHttpRequest({});
      await fetchHttpHandler.handle(mockHttpRequest);

      const expectedUrl = `${mockHttpRequest.protocol}//${mockHttpRequest.hostname}/`;
      const requestArgs = winReqSpy.calls.argsFor(0);
      expect(requestArgs[0]).toEqual(expectedUrl);
      expect(requestArgs[1].method).toEqual(mockHttpRequest.method);
      expect(requestArgs[1].keepalive).toEqual(true);
    });

    for (const method of ["GET", "HEAD"]) {
      it(`sets body to undefined when method: '${method}'`, async () => {
        const fetchHttpHandler = new FetchHttpHandler();
        const winReqSpy = spyOn(window, "Request");

        const mockHttpRequest = getMockHttpRequest({ method, body: "test" });
        await fetchHttpHandler.handle(mockHttpRequest);

        const requestArgs = winReqSpy.calls.argsFor(0);
        expect(requestArgs[1].method).toEqual(mockHttpRequest.method);
        expect(requestArgs[1].body).toEqual(undefined);
      });
    }

    it(`sets keepalive to false if explicitly requested`, async () => {
      const fetchHttpHandler = new FetchHttpHandler({ keepAlive: false });
      const winReqSpy = spyOn(window, "Request");

      const mockHttpRequest = getMockHttpRequest({});
      await fetchHttpHandler.handle(mockHttpRequest);

      const requestArgs = winReqSpy.calls.argsFor(0);
      expect(requestArgs[1].keepalive).toEqual(false);
    });

    it(`builds querystring if provided`, async () => {
      const fetchHttpHandler = new FetchHttpHandler();
      const winReqSpy = spyOn(window, "Request");

      const query = { foo: "bar" };
      const fragment = "test";
      const mockHttpRequest = getMockHttpRequest({ query, fragment });
      await fetchHttpHandler.handle(mockHttpRequest);

      const expectedUrl = `${mockHttpRequest.protocol}//${mockHttpRequest.hostname}/?${Object.entries(query)
        .map(([key, val]) => `${key}=${val}`)
        .join("&")}#${fragment}`;
      const requestArgs = winReqSpy.calls.argsFor(0);
      expect(requestArgs[0]).toEqual(expectedUrl);
    });

    it(`sets auth if username/password are provided`, async () => {
      const fetchHttpHandler = new FetchHttpHandler();
      const winReqSpy = spyOn(window, "Request");

      const username = "foo";
      const password = "bar";
      const mockHttpRequest = getMockHttpRequest({ username, password });
      await fetchHttpHandler.handle(mockHttpRequest);

      const mockAuth = `${mockHttpRequest.username}:${mockHttpRequest.password}`;
      const expectedUrl = `${mockHttpRequest.protocol}//${mockAuth}@${mockHttpRequest.hostname}/`;
      const requestArgs = winReqSpy.calls.argsFor(0);
      expect(requestArgs[0]).toEqual(expectedUrl);
    });
  });
});
