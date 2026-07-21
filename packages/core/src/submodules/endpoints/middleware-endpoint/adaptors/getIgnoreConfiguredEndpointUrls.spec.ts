import { describe, expect, test as it } from "vitest";

import {
  CONFIG_IGNORE_CONFIGURED_ENDPOINT_URLS,
  ENV_IGNORE_CONFIGURED_ENDPOINT_URLS,
  ignoreConfiguredEndpointUrlsConfigSelectors,
} from "./getIgnoreConfiguredEndpointUrls";

describe("ignoreConfiguredEndpointUrlsConfigSelectors", () => {
  describe("environmentVariableSelector", () => {
    it("returns true when env var is 'true'", () => {
      const env = { [ENV_IGNORE_CONFIGURED_ENDPOINT_URLS]: "true" };
      expect(ignoreConfiguredEndpointUrlsConfigSelectors.environmentVariableSelector(env)).toBe(true);
    });

    it("returns false when env var is 'false'", () => {
      const env = { [ENV_IGNORE_CONFIGURED_ENDPOINT_URLS]: "false" };
      expect(ignoreConfiguredEndpointUrlsConfigSelectors.environmentVariableSelector(env)).toBe(false);
    });

    it("returns undefined when env var is not set", () => {
      expect(ignoreConfiguredEndpointUrlsConfigSelectors.environmentVariableSelector({})).toBeUndefined();
    });

    it("throws when env var is an invalid value", () => {
      const env = { [ENV_IGNORE_CONFIGURED_ENDPOINT_URLS]: "yes" };
      expect(() => ignoreConfiguredEndpointUrlsConfigSelectors.environmentVariableSelector(env)).toThrow();
    });
  });

  describe("configFileSelector", () => {
    it("returns true when config value is 'true'", () => {
      const profile = { [CONFIG_IGNORE_CONFIGURED_ENDPOINT_URLS]: "true" };
      expect(ignoreConfiguredEndpointUrlsConfigSelectors.configFileSelector(profile)).toBe(true);
    });

    it("returns false when config value is 'false'", () => {
      const profile = { [CONFIG_IGNORE_CONFIGURED_ENDPOINT_URLS]: "false" };
      expect(ignoreConfiguredEndpointUrlsConfigSelectors.configFileSelector(profile)).toBe(false);
    });

    it("returns undefined when config value is not set", () => {
      expect(ignoreConfiguredEndpointUrlsConfigSelectors.configFileSelector({})).toBeUndefined();
    });

    it("throws when config value is an invalid value", () => {
      const profile = { [CONFIG_IGNORE_CONFIGURED_ENDPOINT_URLS]: "1" };
      expect(() => ignoreConfiguredEndpointUrlsConfigSelectors.configFileSelector(profile)).toThrow();
    });
  });

  describe("default", () => {
    it("defaults to false", () => {
      expect(ignoreConfiguredEndpointUrlsConfigSelectors.default).toBe(false);
    });
  });
});
