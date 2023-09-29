import { HttpRequest } from "@smithy/protocol-http";
import { QueryParameterBag } from "@smithy/types";

import { FetchHttpHandler } from "./fetch-http-handler";

describe(FetchHttpHandler.name, () => {
  interface MockHttpRequestOptions {
    method?: string;
    body?: any;
    query?: QueryParameterBag;
    fragment?: string;
  }

  const getMockHttpRequest = ({ method, body, query, fragment }: MockHttpRequestOptions): HttpRequest =>
    new HttpRequest({ method, hostname: "example.com", body, query, fragment });

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

    it(`sets keepalive to false if explcitly requested`, async () => {
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
  });
});
