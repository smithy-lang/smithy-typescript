import { IniSectionType } from "@smithy/types";

import { getConfigData } from "./getConfigData";
import { CONFIG_PREFIX_SEPARATOR } from "./loadSharedConfigFiles";

describe(getConfigData.name, () => {
  it("returns empty for no data", () => {
    expect(getConfigData({})).toStrictEqual({});
  });

  it("returns default profile if present", () => {
    const mockInput = { default: { key: "value" } };
    expect(getConfigData(mockInput)).toStrictEqual(mockInput);
  });

  it("skips profiles without prefix profile", () => {
    const mockInput = { test: { key: "value" } };
    expect(getConfigData(mockInput)).toStrictEqual({});
  });

  it.each([IniSectionType.SSO_SESSION, IniSectionType.SERVICES])("includes sections with '%s' prefix", (prefix) => {
    const mockInput = { [[prefix, "test"].join(CONFIG_PREFIX_SEPARATOR)]: { key: "value" } };
    expect(getConfigData(mockInput)).toStrictEqual(mockInput);

    // Profile name containing CONFIG_PREFIX_SEPARATOR
    const profileName = ["foo", "bar"].join(CONFIG_PREFIX_SEPARATOR);
    const mockInput2 = { [[prefix, profileName].join(CONFIG_PREFIX_SEPARATOR)]: { key: "value" } };
    expect(getConfigData(mockInput2)).toStrictEqual(mockInput2);
  });

  describe("normalizes profile names", () => {
    const getMockProfileData = (profileName: string) =>
      [1, 2, 3]
        .map((num) => [`key_${profileName}_${num}`, `value_${profileName}_${num}`])
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    const getMockOutput = (profileNames: string[]) =>
      profileNames.reduce((acc, profileName) => ({ ...acc, [profileName]: getMockProfileData(profileName) }), {});

    const getMockInput = (mockOutput: Record<string, Record<string, string>>) =>
      Object.entries(mockOutput).reduce(
        (acc, [key, value]) => ({ ...acc, [[IniSectionType.PROFILE, key].join(CONFIG_PREFIX_SEPARATOR)]: value }),
        {}
      );

    it("profile containing CONFIG_PREFIX_SEPARATOR", () => {
      const profileName = ["foo", "bar"].join(CONFIG_PREFIX_SEPARATOR);
      const mockOutput = getMockOutput([profileName]);
      const mockInput = getMockInput(mockOutput);
      expect(getConfigData(mockInput)).toStrictEqual(mockOutput);
    });

    it("single profile", () => {
      const mockOutput = getMockOutput(["one"]);
      const mockInput = getMockInput(mockOutput);
      expect(getConfigData(mockInput)).toStrictEqual(mockOutput);
    });

    it("two profiles", () => {
      const mockOutput = getMockOutput(["one", "two"]);
      const mockInput = getMockInput(mockOutput);
      expect(getConfigData(mockInput)).toStrictEqual(mockOutput);
    });

    it("three profiles", () => {
      const mockOutput = getMockOutput(["one", "two", "three"]);
      const mockInput = getMockInput(mockOutput);
      expect(getConfigData(mockInput)).toStrictEqual(mockOutput);
    });

    it("with default", () => {
      const defaultInput = { default: { key: "value" } };
      const mockOutput = getMockOutput(["one"]);
      const mockInput = getMockInput(mockOutput);
      expect(getConfigData({ ...defaultInput, ...mockInput })).toStrictEqual({ ...defaultInput, ...mockOutput });
    });

    it("with profileName without prefix", () => {
      const profileWithPrefix = { test: { key: "value" } };
      const mockOutput = getMockOutput(["one"]);
      const mockInput = getMockInput(mockOutput);
      expect(getConfigData({ ...profileWithPrefix, ...mockInput })).toStrictEqual(mockOutput);
    });
  });
});
