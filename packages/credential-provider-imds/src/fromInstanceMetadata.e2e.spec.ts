import { CredentialsProviderError } from "@smithy/property-provider";
import { afterEach, beforeEach, describe, expect, test as it } from "vitest";

import { fromInstanceMetadata, getMetadataToken } from "./fromInstanceMetadata";

describe("fromInstanceMetadata (Live EC2 E2E Tests)", () => {
  const originalEnv = { ...process.env };
  let imdsAvailable = false;

  beforeEach(async () => {
    process.env = { ...originalEnv };

    // Check IMDS availability
    try {
      const testProvider = fromInstanceMetadata({ timeout: 1000, maxRetries: 0 });
      await testProvider();
      imdsAvailable = true;
    } catch (err) {
      imdsAvailable = false;
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should fetch metadata token successfully", async () => {
    if (!imdsAvailable) {
      return;
    }
    const options = {
      path: "/latest/api/token",
      method: "PUT",
      timeout: 1000,
      headers: {
        "x-aws-ec2-metadata-token-ttl-seconds": "21600",
      },
    };
    const token = await getMetadataToken(options);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("retrieves credentials with account ID on allowlisted instances only)", async () => {
    if (!imdsAvailable) return;

    const provider = fromInstanceMetadata({ timeout: 1000, maxRetries: 2 });
    const credentials = await provider();

    expect(credentials).toHaveProperty("accessKeyId");
    expect(credentials).toHaveProperty("secretAccessKey");
    expect(typeof credentials.accessKeyId).toBe("string");
    expect(typeof credentials.secretAccessKey).toBe("string");

    if (!credentials.accountId) {
      console.log("Skipping account ID test not an allowlisted instance");
      return;
    }

    expect(credentials.accountId).toBeDefined();
    expect(typeof credentials.accountId).toBe("string");

    console.log("IMDSv2 Credentials with Account ID:", {
      accessKeyId: credentials.accessKeyId,
      sessionToken: credentials.sessionToken?.slice(0, 10) + "...",
      accountId: credentials.accountId,
    });
  });

  it("IMDS access disabled via AWS_EC2_METADATA_DISABLED", async () => {
    process.env.AWS_EC2_METADATA_DISABLED = "true";

    const provider = fromInstanceMetadata({ timeout: 1000 });

    await expect(provider()).rejects.toThrow("IMDS credential fetching is disabled");
  });

  it("Empty configured profile name should throw error", async () => {
    process.env.AWS_EC2_INSTANCE_PROFILE_NAME = "   ";

    const provider = fromInstanceMetadata({ timeout: 1000 });

    await expect(provider()).rejects.toThrow();
  });

  it("Uses configured profile name from env", async () => {
    if (!imdsAvailable) return;

    process.env.AWS_EC2_INSTANCE_PROFILE_NAME = "foo-profile";
    const provider = fromInstanceMetadata({ timeout: 1000 });

    try {
      const credentials = await provider();
      expect(credentials).toHaveProperty("accessKeyId");
      console.log("Used configured profile name from env.");
    } catch (error) {
      expect(error).toBeDefined();
      console.log("Profile test completed (profile may not exist).");
    }
  });

  it("Multiple calls return stable results", async () => {
    if (!imdsAvailable) return;

    const provider = fromInstanceMetadata({ timeout: 1000 });
    const creds1 = await provider();
    const creds2 = await provider();

    expect(creds1.accessKeyId).toBeTruthy();
    expect(creds2.accessKeyId).toBeTruthy();
    expect(creds1.accessKeyId).toBe(creds2.accessKeyId);

    console.log("Stable credentials returned across calls.");
  });

  it("should timeout as expected when a request exceeds the specified duration", async () => {
    if (!imdsAvailable) return;
    const provider = fromInstanceMetadata({ timeout: 1 });

    await expect(provider()).rejects.toThrow(/timeout|timed out|TimeoutError/i);
  });
});
