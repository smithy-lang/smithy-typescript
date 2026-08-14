import { describe, expect, test as it } from "vitest";

import { toEndpointV1 } from "./toEndpointV1";

describe(toEndpointV1.name, () => {
  it("converts string endpoint", () => {
    const result = toEndpointV1("https://example.com/path");

    expect(result).toEqual({
      protocol: "https:",
      hostname: "example.com",
      path: "/path",
    });
  });

  it("converts EndpointV2 to EndpointV1 with url", () => {
    const result = toEndpointV1({
      url: new URL("https://example.com/path"),
    });

    expect(result).toEqual({
      protocol: "https:",
      hostname: "example.com",
      path: "/path",
    });
  });

  it("converts EndpointV2 headers to EndpointV1 format", () => {
    const result = toEndpointV1({
      url: new URL("https://example.com/path"),
      headers: {
        "x-api-key": ["key-value"],
        "x-custom-header": ["value1", "value2"],
      },
    });

    expect(result).toEqual({
      protocol: "https:",
      hostname: "example.com",
      path: "/path",
      headers: {
        "x-api-key": "key-value",
        "x-custom-header": "value1, value2",
      },
    });
  });

  it("does not iterate inherited Object.prototype properties in headers", () => {
    Object.defineProperty(Object.prototype, "testProp", {
      value: "not-an-array",
      enumerable: true,
      configurable: true,
      writable: true,
    });

    try {
      const result = toEndpointV1({
        url: new URL("https://example.com/path"),
        headers: {},
      });

      expect(result.protocol).toBe("https:");
      expect(result.hostname).toBe("example.com");
      expect(result.path).toBe("/path");
      expect(Object.keys(result.headers!)).toEqual([]);
    } finally {
      delete (Object.prototype as any).testProp;
    }
  });

  it("passes through EndpointV1", () => {
    const v1Endpoint = {
      protocol: "https:",
      hostname: "example.com",
      path: "/path",
    };

    const result = toEndpointV1(v1Endpoint);

    expect(result).toBe(v1Endpoint);
  });
});
