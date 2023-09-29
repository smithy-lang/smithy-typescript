import { HttpRequest } from "@smithy/protocol-http";

import { FetchHttpHandler } from "./fetch-http-handler";

describe(FetchHttpHandler.name, () => {
  const getMockHttpRequest = ({ method, body }: { method?: string; body?: any }): HttpRequest =>
    new HttpRequest({ method, hostname: "example.com", body });

  describe("fetch", () => {
    it("sends basic fetch request", async () => {
      const fetchHttpHandler = new FetchHttpHandler();
      const winReqSpy = spyOn(window, "Request");

      const mockHttpRequest = getMockHttpRequest({});
      await fetchHttpHandler.handle(mockHttpRequest);

      const expectedUrl = `${mockHttpRequest.protocol}//${mockHttpRequest.hostname}${mockHttpRequest.path}`;
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
  });
});
