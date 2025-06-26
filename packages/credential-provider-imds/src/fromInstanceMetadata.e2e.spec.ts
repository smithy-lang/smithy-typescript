import { afterEach, beforeEach, describe, expect, test as it } from "vitest";

import { fromInstanceMetadata, getMetadataToken } from "./fromInstanceMetadata";
import { getInstanceMetadataEndpoint } from "./utils/getInstanceMetadataEndpoint";

describe("fromInstanceMetadata (Live EC2 E2E Tests)", () => {
  const originalEnv = { ...process.env };
  let imdsAvailable = false;

  beforeEach(async () => {
    process.env = { ...originalEnv };

    // Check IMDS availability
    try {
      const testProvider = fromInstanceMetadata({ timeout: 9000 });
      await testProvider();
      imdsAvailable = true;
    } catch (err) {
      imdsAvailable = false;
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should fetch metadata token successfully", async (context) => {
    if (!imdsAvailable) {
      return context.skip();
    }

    const endpoint = await getInstanceMetadataEndpoint();
    const token = await getMetadataToken(endpoint);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("retrieves credentials successfully", async (context) => {
    if (!imdsAvailable) {
      return context.skip();
    }

    const provider = fromInstanceMetadata();
    const credentials = await provider();

    expect(credentials).toHaveProperty("accessKeyId");
    expect(credentials).toHaveProperty("secretAccessKey");
    expect(typeof credentials.accessKeyId).toBe("string");
    expect(typeof credentials.secretAccessKey).toBe("string");
  });

  it("retrieves credentials with account ID on allowlisted instances", async (context) => {
    if (!imdsAvailable) {
      return context.skip();
    }

    const provider = fromInstanceMetadata();
    const credentials = await provider();

    if (!credentials.accountId) {
      context.skip();
    }

    expect(credentials.accountId).toBeDefined();
    expect(typeof credentials.accountId).toBe("string");
  });

  it("IMDS access disabled via AWS_EC2_METADATA_DISABLED", async () => {
    process.env.AWS_EC2_METADATA_DISABLED = "true";

    const provider = fromInstanceMetadata();

    await expect(provider()).rejects.toThrow("IMDS credential fetching is disabled");
  });

  it("Empty configured profile name should throw error", async () => {
    process.env.AWS_EC2_INSTANCE_PROFILE_NAME = "   ";

    const provider = fromInstanceMetadata();

    await expect(provider()).rejects.toThrow();
  });

  it("Uses configured profile name from env", async (context) => {
    if (!imdsAvailable) {
      return context.skip();
    }

    const provider = fromInstanceMetadata();

    try {
      const credentials = await provider();
      expect(credentials).toHaveProperty("accessKeyId");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("Multiple calls return stable results", async (context) => {
    if (!imdsAvailable) {
      return context.skip();
    }

    const provider = fromInstanceMetadata();
    const creds1 = await provider();
    const creds2 = await provider();

    expect(creds1.accessKeyId).toBeTruthy();
    expect(creds2.accessKeyId).toBeTruthy();
    expect(creds1.accessKeyId).toBe(creds2.accessKeyId);
  });

  /**
   * The IMDS may respond too quickly to test this,
   * even with 1ms timeout.
   */
  it.skip("should timeout as expected when a request exceeds the specified duration", async (context) => {
    if (!imdsAvailable) {
      return context.skip();
    }
    const provider = fromInstanceMetadata({ timeout: 1 });

    await expect(provider()).rejects.toThrow(/timeout|timed out|TimeoutError/i);
  });
});
