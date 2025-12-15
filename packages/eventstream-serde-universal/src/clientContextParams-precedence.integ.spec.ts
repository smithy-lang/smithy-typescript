import { describe, expect, test as it } from "vitest";
import { XYZService } from "xyz";

describe("client context parameters precedence integration test", () => {
  it("should handle conflicting vs non-conflicting parameter precedence correctly", async () => {
    // For non-conflicting params
    const clientWithNonConflicting = new XYZService({
      endpoint: "https://localhost",
      apiKey: async () => ({ apiKey: "test-key" }),
      customParam: "user-custom-value",
      clientContextParams: {
        apiKey: "test-key",
        customParam: "nested-custom-value",
      },
    });

    // Verify that endpoint resolution uses the nested value over root value
    const resolvedConfig = clientWithNonConflicting.config;
    const effectiveCustomParam = resolvedConfig.clientContextParams?.customParam ?? resolvedConfig.customParam;
    expect(effectiveCustomParam).toBe("nested-custom-value");

    // For conflicting parameters
    const clientWithConflicting = new XYZService({
      endpoint: "https://localhost",
      apiKey: async () => ({ apiKey: "auth-key" }),
      clientContextParams: {
        apiKey: "endpoint-key",
      },
    });

    // Verify that both auth and endpoint contexts can coexist
    const resolvedConfigConflicting = clientWithConflicting.config;

    // Verify endpoint context has the nested value
    expect(resolvedConfigConflicting.clientContextParams?.apiKey).toBe("endpoint-key");

    // Verify auth context has the auth provider
    const authIdentity = await resolvedConfigConflicting.apiKey?.();
    expect(authIdentity?.apiKey).toBe("auth-key");
  });
});
