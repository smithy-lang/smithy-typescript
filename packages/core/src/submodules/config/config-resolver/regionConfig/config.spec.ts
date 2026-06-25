import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import {
  NODE_REGION_CONFIG_FILE_OPTIONS,
  NODE_REGION_CONFIG_OPTIONS,
  REGION_ENV_NAME,
  REGION_INI_NAME,
} from "./config";
import { getInstanceMetadataRegion } from "./getInstanceMetadataRegion";

vi.mock("./getInstanceMetadataRegion");

describe("config", () => {
  describe("NODE_REGION_CONFIG_OPTIONS", () => {
    describe("environmentVariableSelector", () => {
      const { environmentVariableSelector } = NODE_REGION_CONFIG_OPTIONS;
      it.each([undefined, "mockRegion"])(`when env[${REGION_ENV_NAME}]: %s`, (mockEndpoint) => {
        expect(environmentVariableSelector({ [REGION_ENV_NAME]: mockEndpoint })).toBe(mockEndpoint);
      });
    });

    describe("configFileSelector", () => {
      const { configFileSelector } = NODE_REGION_CONFIG_OPTIONS;
      it.each([undefined, "mockRegion"])(`when env[${REGION_INI_NAME}]: %s`, (mockEndpoint) => {
        expect(configFileSelector({ [REGION_INI_NAME]: mockEndpoint })).toBe(mockEndpoint);
      });
    });

    describe("default", () => {
      beforeEach(() => {
        vi.mocked(getInstanceMetadataRegion).mockReset();
      });

      afterEach(() => {
        vi.resetAllMocks();
      });

      it("returns IMDS region when available", async () => {
        vi.mocked(getInstanceMetadataRegion).mockResolvedValue("us-west-2");
        const { default: defaultKey } = NODE_REGION_CONFIG_OPTIONS;
        await expect((defaultKey as () => Promise<string>)()).resolves.toBe("us-west-2");
      });

      it("throws Region is missing when IMDS returns undefined", async () => {
        vi.mocked(getInstanceMetadataRegion).mockResolvedValue(undefined);
        const { default: defaultKey } = NODE_REGION_CONFIG_OPTIONS;
        await expect((defaultKey as () => Promise<string>)()).rejects.toThrowError(new Error("Region is missing"));
      });
    });
  });

  describe("NODE_REGION_CONFIG_FILE_OPTIONS", () => {
    it("preferredFile contains credentials", () => {
      const { preferredFile } = NODE_REGION_CONFIG_FILE_OPTIONS;
      expect(preferredFile).toBe("credentials");
    });
  });
});
