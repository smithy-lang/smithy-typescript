import { QueryParameterBag } from "@smithy/types";

import { HttpRequest, IHttpRequest } from "./httpRequest";

describe("HttpRequest", () => {
  const httpRequest: IHttpRequest = {
    headers: {
      hKey: "header-value",
    },
    query: {
      qKey: "query-value",
    },
    method: "GET",
    protocol: "https",
    hostname: "localhost",
    path: "/",
    body: [],
  };

  it("should statically clone with deep-cloned headers/query but shallow cloned body", () => {
    const httpRequest: IHttpRequest = {
      headers: {
        hKey: "header-value",
      },
      query: {
        qKey: "query-value",
      },
      method: "GET",
      protocol: "https",
      hostname: "localhost",
      path: "/",
      body: [],
    };

    const clone1 = HttpRequest.clone(httpRequest);
    const clone2 = HttpRequest.clone(httpRequest);

    expect(new HttpRequest(httpRequest)).toEqual(clone1);
    expect(clone1).toEqual(clone2);

    expect(clone1.query).not.toBe(clone2.query);
    expect(clone1.headers).not.toBe(clone2.headers);
    expect(clone1.body).toBe(clone2.body);
  });

  it("should maintain a deprecated instance clone method", () => {
    const httpRequestInstance = new HttpRequest(httpRequest);

    const clone1 = HttpRequest.clone(httpRequestInstance);
    const clone2 = HttpRequest.clone(httpRequestInstance);

    expect(httpRequestInstance).toEqual(clone1);
    expect(clone1).toEqual(clone2);

    expect(clone1.query).not.toBe(clone2.query);
    expect(clone1.headers).not.toBe(clone2.headers);
    expect(clone1.body).toBe(clone2.body);
  });
});

const cloneRequest = HttpRequest.clone;

describe("cloneRequest", () => {
  const request: IHttpRequest = Object.freeze({
    method: "GET",
    protocol: "https:",
    hostname: "foo.us-west-2.amazonaws.com",
    path: "/",
    headers: Object.freeze({
      foo: "bar",
      compound: "value 1, value 2",
    }),
    query: Object.freeze({
      fizz: "buzz",
      snap: ["crackle", "pop"],
    }),
  });

  it("should return an object matching the provided request", () => {
    expect(cloneRequest(request)).toEqual(request);
  });

  it("should return an object that with a different identity", () => {
    expect(cloneRequest(request)).not.toBe(request);
  });

  it("should should deep-copy the headers", () => {
    const clone = cloneRequest(request);

    delete clone.headers.compound;
    expect(Object.keys(request.headers)).toEqual(["foo", "compound"]);
    expect(Object.keys(clone.headers)).toEqual(["foo"]);
  });

  it("should should deep-copy the query", () => {
    const clone = cloneRequest(request);

    const { snap } = clone.query as QueryParameterBag;
    (snap as Array<string>).shift();

    expect((request.query as QueryParameterBag).snap).toEqual(["crackle", "pop"]);
    expect((clone.query as QueryParameterBag).snap).toEqual(["pop"]);
  });

  it("should not copy the body", () => {
    const body = new Uint8Array(16);
    const req = { ...request, body };
    const clone = cloneRequest(req);

    expect(clone.body).toBe(req.body);
  });

  it("should handle requests without defined query objects", () => {
    expect(cloneRequest({ ...request, query: void 0 }).query).not.toBeDefined();
  });
});
