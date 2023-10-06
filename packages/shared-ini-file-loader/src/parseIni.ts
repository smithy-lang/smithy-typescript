import { IniSectionType, ParsedIniData } from "@smithy/types";

import { CONFIG_PREFIX_SEPARATOR } from "./loadSharedConfigFiles";

const prefixKeyRegex = /^([\w]+)\s(["'])?([\w-]+)\2$/;
const profileNameBlockList = ["__proto__", "profile __proto__"];

export const parseIni = (iniData: string): ParsedIniData => {
  const map: ParsedIniData = {};

  let currentSection: string | undefined;
  let currentSubSection: string | undefined;

  for (let line of iniData.split(/\r?\n/)) {
    line = line.split(/(^|\s)[;#]/)[0].trim(); // remove comments and trim
    const isSection: boolean = line[0] === "[" && line[line.length - 1] === "]";
    if (isSection) {
      // New section found. Reset currentSection and currentSubSection.
      currentSection = undefined;
      currentSubSection = undefined;

      const sectionName = line.substring(1, line.length - 1);
      const matches = prefixKeyRegex.exec(sectionName);
      if (matches) {
        const [, prefix, , name] = matches;
        // Add prefix, if the section name starts with `profile`, `sso-session` or `services`.
        if (Object.values(IniSectionType).includes(prefix as IniSectionType)) {
          currentSection = [prefix, name].join(CONFIG_PREFIX_SEPARATOR);
        }
      } else {
        // If the section name does not match the regex, use the section name as is.
        currentSection = sectionName;
      }

      if (profileNameBlockList.includes(sectionName)) {
        throw new Error(`Found invalid profile name "${sectionName}"`);
      }
    } else if (currentSection) {
      const indexOfEqualsSign = line.indexOf("=");
      if (![0, -1].includes(indexOfEqualsSign)) {
        const [name, value]: [string, string] = [
          line.substring(0, indexOfEqualsSign).trim(),
          line.substring(indexOfEqualsSign + 1).trim(),
        ];
        if (value === "") {
          currentSubSection = name;
        } else {
          map[currentSection] = map[currentSection] || {};
          const key = currentSubSection ? [currentSubSection, name].join(CONFIG_PREFIX_SEPARATOR) : name;
          map[currentSection][key] = value;
        }
      }
    }
  }

  return map;
};
