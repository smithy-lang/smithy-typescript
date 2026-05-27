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
