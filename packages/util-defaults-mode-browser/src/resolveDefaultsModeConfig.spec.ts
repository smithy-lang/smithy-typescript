import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { DEFAULTS_MODE_OPTIONS } from "./constants";
import { resolveDefaultsModeConfig } from "./resolveDefaultsModeConfig";

/**
 * @internal
 */
type NavigatorTestAugment = Navigator & {
  userAgentData?: {
    mobile?: boolean;
  };
  connection?: {
    effectiveType?: "4g" | string;
    rtt?: number;
    downlink?: number;
  };
};

describe("resolveDefaultsModeConfig", () => {
  const uaSpy = vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("some UA");

  beforeEach(() => {
    const navigator = window.navigator as NavigatorTestAugment;
    if (!navigator.userAgentData || !navigator.connection) {
      navigator.userAgentData = {};
      navigator.connection = {};
    }
  });

  afterEach(() => {
    const navigator = window.navigator as NavigatorTestAugment;
    delete navigator.userAgentData;
    delete navigator.connection;
    uaSpy.mockClear();
  });

  it("should default to legacy", async () => {
    expect(await resolveDefaultsModeConfig({})()).toBe("legacy");
    expect(await resolveDefaultsModeConfig()()).toBe("legacy");
  });

  it.each(DEFAULTS_MODE_OPTIONS)("should resolve %s mode", async (mode) => {
    expect(await resolveDefaultsModeConfig({ defaultsMode: () => Promise.resolve(mode as any) })()).toBe(mode);
  });

  it("should resolve auto mode to mobile if platform is mobile", async () => {
    vi.spyOn(window.navigator as NavigatorTestAugment, "userAgentData", "get").mockReturnValue({
      mobile: true,
    });
    expect(await resolveDefaultsModeConfig({ defaultsMode: () => Promise.resolve("auto") })()).toBe("mobile");
  });

  it("should resolve auto mode to mobile if connection is not 4g (5g is not possible in this enum)", async () => {
    vi.spyOn(window.navigator as NavigatorTestAugment, "connection", "get").mockReturnValue({
      effectiveType: "3g",
    });
    expect(await resolveDefaultsModeConfig({ defaultsMode: () => Promise.resolve("auto") })()).toBe("mobile");
  });

  it("should resolve auto mode to standard if platform not mobile or tablet", async () => {
    expect(await resolveDefaultsModeConfig({ defaultsMode: () => Promise.resolve("auto") })()).toBe("standard");
  });

  it("should memoize the response", async () => {
    const defaultsMode = resolveDefaultsModeConfig({ defaultsMode: () => Promise.resolve("auto") });
    await defaultsMode();
    const spyInvokeCount = uaSpy.mock.calls.length;
    await defaultsMode();
    expect(uaSpy).toBeCalledTimes(spyInvokeCount);
  });

  it.each(["invalid", "abc"])("should throw for invalid value %s", async (mode) => {
    try {
      await resolveDefaultsModeConfig({ defaultsMode: () => Promise.resolve(mode as any) })();
      fail("should throw for invalid modes");
    } catch (e) {
      expect(e.message).toContain("Invalid parameter");
    }
  });
});
