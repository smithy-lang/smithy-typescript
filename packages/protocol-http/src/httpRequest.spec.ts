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

    const clone1 = httpRequestInstance.clone();
    const clone2 = httpRequestInstance.clone();

    expect(httpRequestInstance).toEqual(clone1);
    expect(clone1).toEqual(clone2);

    expect(clone1.query).not.toBe(clone2.query);
    expect(clone1.headers).not.toBe(clone2.headers);
    expect(clone1.body).toBe(clone2.body);
  });
});
