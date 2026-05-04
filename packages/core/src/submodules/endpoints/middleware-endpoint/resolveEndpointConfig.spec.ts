import { describe, expect, test as it, vi } from "vitest";

import { resolveEndpointConfig } from "./resolveEndpointConfig";

describe(resolveEndpointConfig.name, () => {
  it("maintains object custody", () => {
    const input = {
      tls: true,
      useFipsEndpoint: true,
      useDualstackEndpoint: true,
      endpointProvider: vi.fn(),
      urlParser: vi.fn(),
      region: async () => "us-east-1",
    };
    expect(resolveEndpointConfig(input)).toBe(input);
  });
});
