import { ParsedIniData } from "@smithy/types";

const profileNameBlockList = ["__proto__", "profile __proto__"];

export const parseIni = (iniData: string): ParsedIniData => {
  const map: ParsedIniData = {};

  let currentSection: string | undefined;
  let currentSubSection: string | undefined;

  for (let line of iniData.split(/\r?\n/)) {
    line = line.split(/(^|\s)[;#]/)[0].trim(); // remove comments and trim
    const isSection: boolean = line[0] === "[" && line[line.length - 1] === "]";
    if (isSection) {
      currentSubSection = undefined;
      currentSection = line.substring(1, line.length - 1);
      if (profileNameBlockList.includes(currentSection)) {
        throw new Error(`Found invalid profile name "${currentSection}"`);
      }
    } else if (currentSection) {
      const [name, value] = line.split("=").map((item) => item.trim());
      if (name !== "") {
        if (value === "") {
          currentSubSection = name;
        }
        if (currentSubSection === undefined) {
          // ToDo: populate subsection in future PR, when IniSection is updated to support subsections.
          if (value !== "") {
            map[currentSection] = map[currentSection] || {};
            map[currentSection][name] = value;
          }
        }
      }
    }
  }

  return map;
};
