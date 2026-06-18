import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { httpRequest } from "./remoteProvider/httpRequest";
import { getInstanceMetadataEndpoint } from "./utils/getInstanceMetadataEndpoint";

vi.mock("./remoteProvider/httpRequest");
vi.mock("./utils/getInstanceMetadataEndpoint");

describe("fromInstanceMetadataRegion", () => {
  const mockEndpoint = { hostname: "169.254.169.254", protocol: "http:", port: 80 } as any;
  const mockToken = "imds-token";
  const mockRegion = "us-west-2";

  let fromInstanceMetadataRegion: typeof import("./fromInstanceMetadataRegion").fromInstanceMetadataRegion;
  let ProviderError: typeof import("@smithy/core/config").ProviderError;

  beforeEach(async () => {
    delete process.env.AWS_EC2_METADATA_DISABLED;
    vi.mocked(getInstanceMetadataEndpoint).mockResolvedValue(mockEndpoint);
    ({ fromInstanceMetadataRegion } = await import("./fromInstanceMetadataRegion"));
    ({ ProviderError } = await import("@smithy/core/config"));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns the region from IMDSv2", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(Buffer.from(mockToken))
      .mockResolvedValueOnce(Buffer.from(mockRegion));

    await expect(fromInstanceMetadataRegion()()).resolves.toBe(mockRegion);
  });

  it("issues a PUT to /latest/api/token before the region GET", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(Buffer.from(mockToken))
      .mockResolvedValueOnce(Buffer.from(mockRegion));

    await fromInstanceMetadataRegion()();

    const [tokenCall, regionCall] = vi.mocked(httpRequest).mock.calls;
    expect(tokenCall[0]).toMatchObject({
      path: "/latest/api/token",
      method: "PUT",
      headers: { "x-aws-ec2-metadata-token-ttl-seconds": "21600" },
    });
    expect(regionCall[0]).toMatchObject({
      path: "/latest/meta-data/placement/region",
      method: "GET",
      headers: { "x-aws-ec2-metadata-token": mockToken },
    });
  });

  it("passes the configured timeout to both IMDS requests", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(Buffer.from(mockToken))
      .mockResolvedValueOnce(Buffer.from(mockRegion));

    await fromInstanceMetadataRegion({ timeout: 250 })();

    const calls = vi.mocked(httpRequest).mock.calls;
    expect(calls[0][0].timeout).toBe(250);
    expect(calls[1][0].timeout).toBe(250);
  });

  it("defaults timeout to 1000 ms", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(Buffer.from(mockToken))
      .mockResolvedValueOnce(Buffer.from(mockRegion));

    await fromInstanceMetadataRegion()();

    expect(vi.mocked(httpRequest).mock.calls[0][0].timeout).toBe(1000);
  });

  it("trims whitespace from the region response", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(Buffer.from(mockToken))
      .mockResolvedValueOnce(Buffer.from(`  ${mockRegion}\n`));

    await expect(fromInstanceMetadataRegion()()).resolves.toBe(mockRegion);
  });

  it("throws ProviderError with tryNextLink when AWS_EC2_METADATA_DISABLED is set", async () => {
    process.env.AWS_EC2_METADATA_DISABLED = "true";

    await expect(fromInstanceMetadataRegion()()).rejects.toMatchObject({
      tryNextLink: true,
    });
    expect(httpRequest).not.toHaveBeenCalled();
  });

  it("throws ProviderError with tryNextLink on empty region body", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(Buffer.from(mockToken))
      .mockResolvedValueOnce(Buffer.from(""));

    await expect(fromInstanceMetadataRegion()()).rejects.toMatchObject({
      tryNextLink: true,
    });
  });

  it("wraps non-ProviderError failures with tryNextLink", async () => {
    vi.mocked(httpRequest).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    // Single invocation so we test the wrap path, not the negative-cache short-circuit.
    const promise = fromInstanceMetadataRegion()();
    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    await expect(promise).rejects.toMatchObject({ tryNextLink: true });
  });

  it("memoizes negative results within the cache TTL", async () => {
    vi.mocked(httpRequest).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(fromInstanceMetadataRegion()()).rejects.toBeInstanceOf(ProviderError);
    await expect(fromInstanceMetadataRegion()()).rejects.toBeInstanceOf(ProviderError);

    expect(httpRequest).toHaveBeenCalledTimes(1);
  });

  it("retries the token PUT up to maxRetries times before failing", async () => {
    vi.mocked(httpRequest)
      .mockRejectedValueOnce(new Error("attempt 1"))
      .mockRejectedValueOnce(new Error("attempt 2"))
      .mockResolvedValueOnce(Buffer.from(mockToken))
      .mockResolvedValueOnce(Buffer.from(mockRegion));

    await expect(fromInstanceMetadataRegion({ maxRetries: 2 })()).resolves.toBe(mockRegion);
    // 2 failed token attempts + 1 successful token attempt + 1 region attempt = 4
    expect(httpRequest).toHaveBeenCalledTimes(4);
  });

  it("defaults maxRetries to 0", async () => {
    vi.mocked(httpRequest).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(fromInstanceMetadataRegion()()).rejects.toBeInstanceOf(ProviderError);
    expect(httpRequest).toHaveBeenCalledTimes(1);
  });
});
