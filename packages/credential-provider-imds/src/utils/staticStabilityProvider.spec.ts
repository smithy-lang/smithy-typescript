import { Logger } from "@smithy/types";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { getExtendedInstanceMetadataCredentials } from "./getExtendedInstanceMetadataCredentials";
import { staticStabilityProvider } from "./staticStabilityProvider";

vi.mock("./getExtendedInstanceMetadataCredentials");

describe("staticStabilityProvider", () => {
  const ONE_HOUR_IN_FUTURE = new Date(Date.now() + 60 * 60 * 1000);
  const mockCreds = {
    accessKeyId: "key",
    secretAccessKey: "secret",
    sessionToken: "settion",
    expiration: ONE_HOUR_IN_FUTURE,
  };

  beforeEach(() => {
    vi.mocked(getExtendedInstanceMetadataCredentials).mockImplementation(
      (() => {
        let extensionCount = 0;
        return (input) => {
          extensionCount++;
          return {
            ...input,
            expiration: `Extending expiration count: ${extensionCount}`,
          } as any;
        };
      })()
    );
    vi.spyOn(global.console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should refresh credentials if provider is functional", async () => {
    const provider = vi.fn();
    const stableProvider = staticStabilityProvider(provider);
    const repeat = 3;
    for (let i = 0; i < repeat; i++) {
      const newCreds = { ...mockCreds, accessKeyId: String(i + 1) };
      provider.mockReset().mockResolvedValue(newCreds);
      expect(await stableProvider()).toEqual(newCreds);
    }
  });

  it("should throw if cannot load credentials at 1st load", async () => {
    const provider = vi.fn().mockRejectedValue("Error");
    try {
      await staticStabilityProvider(provider)();
      fail("This provider should throw");
    } catch (e) {
      expect(getExtendedInstanceMetadataCredentials).not.toBeCalled();
      expect(provider).toBeCalledTimes(1);
      expect(e).toEqual("Error");
    }
  });

  it("should extend expired credentials if refresh fails", async () => {
    const provider = vi.fn().mockResolvedValueOnce(mockCreds).mockRejectedValue("Error");
    const stableProvider = staticStabilityProvider(provider);
    expect(await stableProvider()).toEqual(mockCreds);
    const repeat = 3;
    for (let i = 0; i < repeat; i++) {
      const newCreds = await stableProvider();
      expect(newCreds).toMatchObject({ ...mockCreds, expiration: expect.stringContaining(`count: ${i + 1}`) });
      expect(console.warn).toHaveBeenLastCalledWith(
        expect.stringContaining("Credential renew failed:"),
        expect.anything()
      );
    }
    expect(getExtendedInstanceMetadataCredentials).toBeCalledTimes(repeat);
    expect(console.warn).toBeCalledTimes(repeat);
  });

  it("should extend expired credentials if loaded expired credentials", async () => {
    const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
    const provider = vi.fn().mockResolvedValue({ ...mockCreds, expiration: ONE_HOUR_AGO });
    const stableProvider = staticStabilityProvider(provider);
    const repeat = 3;
    for (let i = 0; i < repeat; i++) {
      const newCreds = await stableProvider();
      expect(newCreds).toMatchObject({ ...mockCreds, expiration: expect.stringContaining(`count: ${i + 1}`) });
    }
    expect(getExtendedInstanceMetadataCredentials).toBeCalledTimes(repeat);
    expect(console.warn).not.toBeCalled();
  });

  it("should allow custom logger to print warning messages", async () => {
    const provider = vi.fn().mockResolvedValueOnce(mockCreds).mockRejectedValue("Error");
    const logger = { warn: vi.fn() } as unknown as Logger;
    const stableProvider = staticStabilityProvider(provider, { logger });
    expect(await stableProvider()).toEqual(mockCreds); // load initial creds
    await stableProvider();
    expect(logger.warn).toBeCalledTimes(1);
    expect(console.warn).toBeCalledTimes(0);
  });
});
