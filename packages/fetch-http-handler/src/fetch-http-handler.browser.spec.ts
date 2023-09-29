import { HttpRequest } from "@smithy/protocol-http";

import { FetchHttpHandler } from "./fetch-http-handler";

describe(FetchHttpHandler.name, () => {
  const getMockHttpRequest = (): HttpRequest => new HttpRequest({ hostname: "example.com" });

  describe("fetch", () => {
    it("sends basic fetch request", (done) => {
      const fetchHttpHandler = new FetchHttpHandler();
      const winReqSpy = spyOn(window, "Request");

      const mockHttpRequest = getMockHttpRequest();
      fetchHttpHandler.handle(mockHttpRequest);

      const expectedUrl = `${mockHttpRequest.protocol}//${mockHttpRequest.hostname}${mockHttpRequest.path}`;
      const requestArgs = winReqSpy.calls.argsFor(0);
      expect(requestArgs[0]).toEqual(expectedUrl);
      expect(requestArgs[1].method).toEqual(mockHttpRequest.method);

      done();
    });
  });
});
