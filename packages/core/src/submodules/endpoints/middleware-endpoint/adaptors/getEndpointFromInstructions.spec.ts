import { afterAll, describe, expect, test as it, vi } from "vitest";

import { getEndpointFromInstructions } from "./getEndpointFromInstructions";

describe(getEndpointFromInstructions.name, () => {
  afterAll(async () => {
    delete process.env.AWS_ENDPOINT_URL;
  });

  it("should set the isCustomEndpoint flag after resolving an externally configured endpoint", async () => {
    process.env.AWS_ENDPOINT_URL = "https://localhost";

    const config = {
      serviceId: "service id",
      isCustomEndpoint: false,
      endpointProvider: vi.fn(),
    };

    await getEndpointFromInstructions(
      {},
      {
        getEndpointParameterInstructions() {
          return {};
        },
      },
      config
    );

    expect(config.isCustomEndpoint).toBe(true);
  });

  it("should not use externally configured endpoint if code-level endpoint was set", async () => {
    process.env.AWS_ENDPOINT_URL = "https://localhost";

    const config = {
      serviceId: "service id",
      isCustomEndpoint: true,
      endpointProvider: vi.fn().mockReturnValue(Symbol.for("endpoint")),
    };

    const endpoint = await getEndpointFromInstructions(
      {},
      {
        getEndpointParameterInstructions() {
          return {};
        },
      },
      config
    );

    expect(config.isCustomEndpoint).toBe(true);
    expect(endpoint).toBe(Symbol.for("endpoint"));
  });
});
