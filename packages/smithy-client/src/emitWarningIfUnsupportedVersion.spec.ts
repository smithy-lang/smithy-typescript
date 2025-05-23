import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

describe.skip("emitWarningIfUnsupportedVersion", () => {
  let emitWarningIfUnsupportedVersion: any;
  const emitWarning = process.emitWarning;
  const supportedVersion = "16.0.0";

  beforeEach(() => {
    const module = require("./emitWarningIfUnsupportedVersion");
    emitWarningIfUnsupportedVersion = module.emitWarningIfUnsupportedVersion;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.emitWarning = emitWarning;
  });

  describe(`emits warning for Node.js <${supportedVersion}`, () => {
    const getPreviousMajorVersion = (major: number) => (major === 0 ? 0 : major - 1);

    const getPreviousMinorVersion = ([major, minor]: [number, number]) =>
      minor === 0 ? [getPreviousMajorVersion(major), 9] : [major, minor - 1];

    const getPreviousPatchVersion = ([major, minor, patch]: [number, number, number]) =>
      patch === 0 ? [...getPreviousMinorVersion([major, minor]), 9] : [major, minor, patch - 1];

    const [major, minor, patch] = supportedVersion.split(".").map(Number);
    it.each(
      [
        getPreviousPatchVersion([major, minor, patch]),
        [...getPreviousMinorVersion([major, minor]), 0],
        [getPreviousMajorVersion(major), 0, 0],
      ].map((arr) => `v${arr.join(".")}`)
    )(`%s`, async (unsupportedVersion) => {
      process.emitWarning = vi.fn();
      emitWarningIfUnsupportedVersion(unsupportedVersion);

      // Verify that the warning was emitted.
      expect(process.emitWarning).toHaveBeenCalledTimes(1);
      expect(process.emitWarning).toHaveBeenCalledWith(`<<TEXT>>`, `NodeDeprecationWarning`);

      // Verify that the warning emits only once.
      emitWarningIfUnsupportedVersion(unsupportedVersion);
      expect(process.emitWarning).toHaveBeenCalledTimes(1);
    });
  });

  describe(`emits no warning for Node.js >=${supportedVersion}`, () => {
    const [major, minor, patch] = supportedVersion.split(".").map(Number);
    it.each(
      [
        [major, minor, patch],
        [major, minor, patch + 1],
        [major, minor + 1, 0],
        [major + 1, 0, 0],
      ].map((arr) => `v${arr.join(".")}`)
    )(`%s`, async (unsupportedVersion) => {
      process.emitWarning = vi.fn();
      emitWarningIfUnsupportedVersion(unsupportedVersion);
      expect(process.emitWarning).not.toHaveBeenCalled();
    });
  });
});
