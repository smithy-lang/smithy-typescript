import { requireRequestsFrom } from "@smithy/util-test/src";
import { describe, expect, test as it } from "vitest";
import { HostPrefixOperationCommand, XYZService } from "xyz-schema";

describe("hostLabel validation", () => {
  it("should prepend valid AccountId to the hostname", async () => {
    const client = new XYZService({
      endpoint: "https://amazon.com",
      apiKey: async () => ({ apiKey: "test-key" }),
    });

    requireRequestsFrom(client).toMatch({
      hostname: "123456789012.amazon.com",
    });

    await client.send(new HostPrefixOperationCommand({ AccountId: "123456789012" }));

    expect.assertions(1);
  });

  it("should reject AccountId containing invalid hostname characters", async () => {
    const client = new XYZService({
      endpoint: "https://amazon.com",
      apiKey: async () => ({ apiKey: "test-key" }),
    });

    await expect(client.send(new HostPrefixOperationCommand({ AccountId: "1234567890/#" }))).rejects.toThrow(
      "resolved hostname is not a valid hostname"
    );
  });

  it("should reject AccountId containing slash", async () => {
    const client = new XYZService({
      endpoint: "https://amazon.com",
      apiKey: async () => ({ apiKey: "test-key" }),
    });

    await expect(client.send(new HostPrefixOperationCommand({ AccountId: "123456789-/" }))).rejects.toThrow(
      "resolved hostname is not a valid hostname"
    );
  });
});
