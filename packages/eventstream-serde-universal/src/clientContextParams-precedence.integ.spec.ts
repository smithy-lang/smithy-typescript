import { describe, expect, test as it } from "vitest";
import { XYZService } from "xyz";

describe("client context parameters precedence integration test", () => {
  it("should handle conflicting vs non-conflicting parameter precedence correctly", async () => {
    // For non-conflicting parameter root level takes precedence over nested defaults
    const clientWithNonConflicting = new XYZService({
      endpoint: "https://localhost",
      apiKey: async () => ({ apiKey: "test-key" }),
      customParam: "user-custom-value",
      clientContextParams: {
        apiKey: "test-key",
        customParam: "default-custom-value",
      },
    });

    // Verify the resolved config has the user's root-level value
    const resolvedConfig = (clientWithNonConflicting as any).config;
    expect(resolvedConfig.customParam).toBe("user-custom-value");

    // For conflicting parameters nested values are used for endpoint resolution
    const clientWithConflicting = new XYZService({
      endpoint: "https://localhost",
      apiKey: async () => ({ apiKey: "auth-key" }),
      clientContextParams: {
        apiKey: "endpoint-key",
      },
    });

    // Verify that both auth and endpoint contexts can coexist
    const resolvedConfigConflicting = (clientWithConflicting as any).config;

    // Verify endpoint context has the nested value
    expect(resolvedConfigConflicting.clientContextParams.apiKey).toBe("endpoint-key");

    // Verify auth context has the auth provider
    const authIdentity = await resolvedConfigConflicting.apiKey();
    expect(authIdentity.apiKey).toBe("auth-key");
  });
});
