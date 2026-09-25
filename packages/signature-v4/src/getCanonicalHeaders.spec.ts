import { hasOwn } from "@smithy/core/transport";
import { HttpRequest } from "@smithy/core/protocols";
import type { HeaderBag } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { ALWAYS_UNSIGNABLE_HEADERS } from "./constants";
import { getCanonicalHeaders } from "./getCanonicalHeaders";

describe("getCanonicalHeaders", () => {
  it("should downcase all headers", () => {
    expect(
      getCanonicalHeaders(
        new HttpRequest({
          method: "POST",
          protocol: "https:",
          path: "/",
          headers: {
            fOo: "bar",
            BaZ: "QUUX",
            HoSt: "foo.us-east-1.amazonaws.com",
          },
          hostname: "foo.us-east-1.amazonaws.com",
        })
      )
    ).toEqual({
      foo: "bar",
      baz: "QUUX",
      host: "foo.us-east-1.amazonaws.com",
    });
  });

  it("should remove all unsignable headers", () => {
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      path: "/",
      headers: {
        "x-amz-user-agent": "aws-sdk-js-v3",
        host: "foo.us-east-1.amazonaws.com",
        foo: "bar",
      },
      hostname: "foo.us-east-1.amazonaws.com",
    });
    for (const headerName in ALWAYS_UNSIGNABLE_HEADERS) {
      if (!hasOwn(ALWAYS_UNSIGNABLE_HEADERS, headerName)) continue;
      request.headers[headerName] = "baz";
    }

    expect(getCanonicalHeaders(request)).toEqual({
      "x-amz-user-agent": "aws-sdk-js-v3",
      host: "foo.us-east-1.amazonaws.com",
      foo: "bar",
    });
  });

  it("should ignore headers with undefined values", () => {
    const headers: HeaderBag = {
      "x-amz-user-agent": "aws-sdk-js-v3",
      host: "foo.us-east-1.amazonaws.com",
      ":authority": "",
    };

    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      path: "/",
      headers: {
        ...headers,
        foo: undefined as any,
        bar: null as any,
      },
      hostname: "foo.us-east-1.amazonaws.com",
    });

    expect(getCanonicalHeaders(request)).toEqual(headers);
  });

  it("should trim and collapse ASCII space and tab", () => {
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      path: "/",
      headers: {
        host: "foo.us-east-1.amazonaws.com",
        foo: "  bar   baz\tqux  ",
      },
      hostname: "foo.us-east-1.amazonaws.com",
    });

    expect(getCanonicalHeaders(request).foo).toBe("bar baz qux");
  });

  it("should not fold U+00A0 (NBSP) into an ASCII space", () => {
    const value = "before\u00a0after";
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      path: "/",
      headers: {
        host: "foo.us-east-1.amazonaws.com",
        "x-amz-meta-filename": value,
      },
      hostname: "foo.us-east-1.amazonaws.com",
    });

    expect(getCanonicalHeaders(request)["x-amz-meta-filename"]).toBe(value);
  });

  it("should replace \\r and \\n with SP", () => {
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      path: "/",
      headers: {
        host: "foo.us-east-1.amazonaws.com",
        foo: "a\nb\rc",
      },
      hostname: "foo.us-east-1.amazonaws.com",
    });

    expect(getCanonicalHeaders(request).foo).toBe("a b c");
  });

  it("should retain other CTL characters and replace \r", () => {
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      path: "/",
      headers: {
        host: "foo.us-east-1.amazonaws.com",
        foo: "a\fb\vc\rd",
      },
      hostname: "foo.us-east-1.amazonaws.com",
    });

    expect(getCanonicalHeaders(request).foo).toBe("a\fb\vc d");
  });

  it("should allow specifying custom unsignable headers", () => {
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      path: "/",
      headers: {
        host: "foo.us-east-1.amazonaws.com",
        foo: "bar",
        "user-agent": "foo-user",
      },
      hostname: "foo.us-east-1.amazonaws.com",
    });

    expect(getCanonicalHeaders(request, new Set(["foo"]))).toEqual({
      host: "foo.us-east-1.amazonaws.com",
    });
  });

  it("should allow specifying custom signable headers that override unsignable ones", () => {
    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      path: "/",
      headers: {
        host: "foo.us-east-1.amazonaws.com",
        foo: "bar",
        "user-agent": "foo-user",
      },
      hostname: "foo.us-east-1.amazonaws.com",
    });

    expect(getCanonicalHeaders(request, new Set(["foo"]), new Set(["foo", "user-agent"]))).toEqual({
      host: "foo.us-east-1.amazonaws.com",
      foo: "bar",
      "user-agent": "foo-user",
    });
  });
});
