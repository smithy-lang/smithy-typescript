import { HttpRequest } from "@smithy/protocol-http";
import { describe, expect, test as it } from "vitest";

import { moveHeadersToQuery } from "./moveHeadersToQuery";

const minimalRequest = new HttpRequest({
  method: "POST",
  protocol: "https:",
  path: "/",
  headers: {
    host: "foo.us-east-1.amazonaws.com",
  },
  hostname: "foo.us-east-1.amazonaws.com",
});

describe("moveHeadersToQuery", () => {
  it('should hoist "x-amz-" headers to the querystring', () => {
    const req = moveHeadersToQuery(
      new HttpRequest({
        ...minimalRequest,
        headers: {
          Host: "www.example.com",
          "X-Amz-Website-Redirect-Location": "/index.html",
          Foo: "bar",
          fizz: "buzz",
          SNAP: "crackle, pop",
          "X-Amz-Storage-Class": "STANDARD_IA",
        },
      })
    );

    expect(req.query).toEqual({
      "X-Amz-Website-Redirect-Location": "/index.html",
      "X-Amz-Storage-Class": "STANDARD_IA",
    });

    expect(req.headers).toEqual({
      Host: "www.example.com",
      Foo: "bar",
      fizz: "buzz",
      SNAP: "crackle, pop",
    });
  });

  it("should not overwrite existing query values with different keys", () => {
    const req = moveHeadersToQuery(
      new HttpRequest({
        ...minimalRequest,
        headers: {
          Host: "www.example.com",
          "X-Amz-Website-Redirect-Location": "/index.html",
          Foo: "bar",
          fizz: "buzz",
          SNAP: "crackle, pop",
          "X-Amz-Storage-Class": "STANDARD_IA",
        },
        query: {
          Foo: "buzz",
          fizz: "bar",
          "X-Amz-Storage-Class": "REDUCED_REDUNDANCY",
        },
      })
    );

    expect(req.query).toEqual({
      Foo: "buzz",
      fizz: "bar",
      "X-Amz-Website-Redirect-Location": "/index.html",
      "X-Amz-Storage-Class": "STANDARD_IA",
    });
  });

  it("should skip hoisting headers to the querystring supplied in unhoistedHeaders", () => {
    const req = moveHeadersToQuery(
      new HttpRequest({
        ...minimalRequest,
        headers: {
          Host: "www.example.com",
          "X-Amz-Website-Redirect-Location": "/index.html",
          Foo: "bar",
          fizz: "buzz",
          SNAP: "crackle, pop",
          "X-Amz-Storage-Class": "STANDARD_IA",
        },
      }),
      {
        unhoistableHeaders: new Set(["x-amz-website-redirect-location"]),
      }
    );

    expect(req.query).toEqual({
      "X-Amz-Storage-Class": "STANDARD_IA",
    });

    expect(req.headers).toEqual({
      Host: "www.example.com",
      "X-Amz-Website-Redirect-Location": "/index.html",
      Foo: "bar",
      fizz: "buzz",
      SNAP: "crackle, pop",
    });
  });

  it("should obey hoistableHeaders configuration over unhoistableHeaders", () => {
    const req = moveHeadersToQuery(
      new HttpRequest({
        ...minimalRequest,
        headers: {
          Host: "www.example.com",
          "X-Amz-Website-Redirect-Location": "/index.html",
          Foo: "bar",
          fizz: "buzz",
          SNAP: "crackle, pop",
          "X-Amz-Storage-Class": "STANDARD_IA",
        },
      }),
      {
        hoistableHeaders: new Set(["x-amz-website-redirect-location", "snap"]),
        unhoistableHeaders: new Set(["x-amz-website-redirect-location"]),
      }
    );

    expect(req.query).toEqual({
      SNAP: "crackle, pop",
      "X-Amz-Storage-Class": "STANDARD_IA",
      "X-Amz-Website-Redirect-Location": "/index.html",
    });

    expect(req.headers).toEqual({
      Host: "www.example.com",
      Foo: "bar",
      fizz: "buzz",
    });
  });
});
