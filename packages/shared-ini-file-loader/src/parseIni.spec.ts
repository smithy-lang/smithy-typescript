import { IniSectionType } from "@smithy/types";

import { CONFIG_PREFIX_SEPARATOR } from "./loadSharedConfigFiles";
import { parseIni } from "./parseIni";

describe(parseIni.name, () => {
  it.each(["__proto__", "profile __proto__"])("throws error if profile name is '%s'", (deniedProfileName) => {
    const initData = `[${deniedProfileName}]\nfoo = not_exist`;
    expect(() => {
      parseIni(initData);
    }).toThrowError(`Found invalid profile name "${deniedProfileName}"`);
  });

  describe("parses config for other keys", () => {
    const mockProfileName = "mock_profile_name";
    const mockProfileData = { key: "value" };

    const getMockProfileDataEntries = (profileData: Record<string, string | Record<string, string>>) =>
      Object.entries(profileData).map(([key, value]) => {
        let result = `${key}=`;
        if (typeof value === "string") {
          result += `${value}`;
        } else {
          result += `\n    ${getMockProfileDataEntries(value).join("\n    ")}`;
        }
        return result;
      });

    const getMockProfileContent = (profileName: string, profileData: Record<string, string | Record<string, string>>) =>
      `[${profileName}]\n${getMockProfileDataEntries(profileData).join("\n")}\n`;

    it("trims data from key/value", () => {
      const mockInput = `[${mockProfileName}]\n  ${Object.entries(mockProfileData)
        .map(([key, value]) => ` ${key} = ${value} `)
        .join("\n")}`;
      expect(parseIni(mockInput)).toStrictEqual({
        [mockProfileName]: mockProfileData,
      });
    });

    it("returns value with equals sign", () => {
      const mockProfileDataWithEqualsSign = { key: "value=value" };
      const mockInput = getMockProfileContent(mockProfileName, mockProfileDataWithEqualsSign);
      expect(parseIni(mockInput)).toStrictEqual({
        [mockProfileName]: mockProfileDataWithEqualsSign,
      });
    });

    it.each(Object.values(IniSectionType))(
      "returns data for section '%s' with separator",
      (sectionType: IniSectionType) => {
        const mockSectionName = "mock_section_name";
        const mockSectionFullName = [sectionType, mockSectionName].join(" ");
        const mockInput = getMockProfileContent(mockSectionFullName, mockProfileData);
        expect(parseIni(mockInput)).toStrictEqual({
          [[sectionType, mockSectionName].join(CONFIG_PREFIX_SEPARATOR)]: mockProfileData,
        });
      }
    );

    // Character `@` is not allowed in profile name, but some customers are using it.
    // Refs: https://github.com/awslabs/smithy-typescript/issues/1026
    it.each(["-", "_", "@"])("returns data for character '%s' in profile name", (specialChar: string) => {
      const mockProfileName = ["profile", "stage"].join(specialChar);
      const mockSectionFullName = ["profile", mockProfileName].join(" ");
      const mockInput = getMockProfileContent(mockSectionFullName, mockProfileData);
      expect(parseIni(mockInput)).toStrictEqual({
        [["profile", mockProfileName].join(CONFIG_PREFIX_SEPARATOR)]: mockProfileData,
      });
    });

    it("returns data for two profiles", () => {
      const mockProfile1 = getMockProfileContent(mockProfileName, mockProfileData);

      const mockProfileName2 = "mock_profile_name_2";
      const mockProfileData2 = { key2: "value2" };
      const mockProfile2 = getMockProfileContent(mockProfileName2, mockProfileData2);

      expect(parseIni(`${mockProfile1}${mockProfile2}`)).toStrictEqual({
        [mockProfileName]: mockProfileData,
        [mockProfileName2]: mockProfileData2,
      });
    });

    it("skip section if data is not present", () => {
      const mockProfileNameWithoutData = "mock_profile_name_without_data";
      const mockInput = getMockProfileContent(mockProfileName, mockProfileData);
      expect(parseIni(`${mockInput}[${mockProfileNameWithoutData}]`)).toStrictEqual({
        [mockProfileName]: mockProfileData,
      });
      expect(parseIni(`[${mockProfileNameWithoutData}]\n${mockInput}`)).toStrictEqual({
        [mockProfileName]: mockProfileData,
      });
    });

    it("returns data for profile containing multiple entries", () => {
      const mockProfileDataMultipleEntries = { key1: "value1", key2: "value2", key3: "value3" };
      const mockInput = getMockProfileContent(mockProfileName, mockProfileDataMultipleEntries);
      expect(parseIni(mockInput)).toStrictEqual({
        [mockProfileName]: mockProfileDataMultipleEntries,
      });
    });

    describe("returns data from main section, and not subsection", () => {
      it("if subsection comes after section", () => {
        const mockProfileDataWithSubSettings = {
          key: "keyValue",
          subSection: {
            key: "keyValueInSubSection",
            subKey: "subKeyValue",
          },
        };
        const mockInput = getMockProfileContent(mockProfileName, mockProfileDataWithSubSettings);
        expect(parseIni(mockInput)).toStrictEqual({
          [mockProfileName]: {
            key: "keyValue",
            [["subSection", "key"].join(CONFIG_PREFIX_SEPARATOR)]: "keyValueInSubSection",
            [["subSection", "subKey"].join(CONFIG_PREFIX_SEPARATOR)]: "subKeyValue",
          },
        });

        const mockProfileName2 = "mock_profile_name_2";
        const mockProfileDataWithSubSettings2 = {
          key: "keyValue2",
          subSection: {
            key: "keyValue2InSubSection",
            subKey: "subKeyValue2",
          },
        };
        const mockInput2 = getMockProfileContent(mockProfileName2, mockProfileDataWithSubSettings2);
        expect(parseIni(`${mockInput}${mockInput2}`)).toStrictEqual({
          [mockProfileName]: {
            key: "keyValue",
            [["subSection", "key"].join(CONFIG_PREFIX_SEPARATOR)]: "keyValueInSubSection",
            [["subSection", "subKey"].join(CONFIG_PREFIX_SEPARATOR)]: "subKeyValue",
          },
          [mockProfileName2]: {
            key: "keyValue2",
            [["subSection", "key"].join(CONFIG_PREFIX_SEPARATOR)]: "keyValue2InSubSection",
            [["subSection", "subKey"].join(CONFIG_PREFIX_SEPARATOR)]: "subKeyValue2",
          },
        });
      });

      it("if subsection comes before section", () => {
        const mockProfileDataWithSubSettings = {
          subSection: {
            key: "keyValueInSubSection",
            subKey: "subKeyValue",
          },
          key: "keyValue",
        };
        const mockInput = getMockProfileContent(mockProfileName, mockProfileDataWithSubSettings);
        expect(parseIni(mockInput)).toStrictEqual({
          [mockProfileName]: {
            [["subSection", "key"].join(CONFIG_PREFIX_SEPARATOR)]: "keyValueInSubSection",
            [["subSection", "subKey"].join(CONFIG_PREFIX_SEPARATOR)]: "subKeyValue",
            key: "keyValue",
          },
        });
      });
    });
  });
});
