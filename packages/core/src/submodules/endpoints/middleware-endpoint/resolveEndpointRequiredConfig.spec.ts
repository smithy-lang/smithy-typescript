import { describe, expect, test as it } from "vitest";

import { resolveEndpointRequiredConfig } from "./resolveEndpointRequiredConfig";

describe(resolveEndpointRequiredConfig.name, () => {
  it("creates a default endpoint resolver function", async () => {
    const config = resolveEndpointRequiredConfig({
      endpoint: undefined as any,
    });

    expect(() => config.endpoint()).rejects.toThrow();
  });
});
