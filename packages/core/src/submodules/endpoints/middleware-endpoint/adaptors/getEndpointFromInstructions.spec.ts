import { afterAll, afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { getEndpointFromInstructions } from "../../index";

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

  describe("logging", () => {
    beforeEach(() => {
      process.env.AWS_ENDPOINT_URL = "https://localhost";
    });

    afterEach(() => {
      delete process.env.AWS_ENDPOINT_URL;
    });

    it("should log the resolved configured endpoint", async () => {
      const debug = vi.fn();
      const config = {
        serviceId: "service id",
        isCustomEndpoint: false,
        endpointProvider: vi.fn(),
      };
      const context = { logger: { debug } };

      await getEndpointFromInstructions(
        {},
        {
          getEndpointParameterInstructions() {
            return {};
          },
        },
        config,
        context as any
      );

      expect(debug).toHaveBeenCalledWith(expect.stringContaining("resolved endpoint from config: https://localhost"));
    });
  });
});
